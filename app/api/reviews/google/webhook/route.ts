import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

const TABLE_NAME =
  process.env.REVIEWS_TABLE ??
  process.env.AUTO_REVIEW_REVIEWS_TABLE ??
  "autoReview-reviews";
const REGION = process.env.AWS_REGION ?? "me-south-1";
const WEBHOOK_URL =
  process.env.GOOGLE_REPLY_WEBHOOK_URL ??
  "https://n8n-app.stg.beno.com/webhook/post_review_reply";

const dynamoClient = new DynamoDBClient({ region: REGION });
const docClient = DynamoDBDocumentClient.from(dynamoClient);

type WebhookPayload = {
  reviewId?: string;
  reviewKey?: string;
  reply?: string;
  source?: string;
};

const safeTrim = (value?: string | null) => value?.trim() ?? "";

const parseWebhookResult = async (response: Response) => {
  const text = await response.text();
  if (!text) {
    return null;
  }
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
};

const toReviewKey = (payload: WebhookPayload) => {
  const rawKey = safeTrim(payload.reviewKey);
  if (rawKey) {
    return rawKey;
  }
  const reviewId = safeTrim(payload.reviewId);
  if (!reviewId) {
    return null;
  }
  if (reviewId.includes("#")) {
    return reviewId;
  }
  const source = safeTrim(payload.source) || "Google";
  return `${source}#${reviewId}`;
};

const updatePostedReply = async (reviewKey: string, reply: string) => {
  if (!TABLE_NAME) {
    return false;
  }
  const nowIso = new Date().toISOString();
  try {
    await docClient.send(
      new UpdateCommand({
        TableName: TABLE_NAME,
        Key: { reviewId: reviewKey },
        UpdateExpression:
          "SET #reply = :reply, #status = :status, updatedAt = :updatedAt, replyPostedAt = :replyPostedAt",
        ExpressionAttributeNames: {
          "#reply": "reply",
          "#status": "status",
        },
        ExpressionAttributeValues: {
          ":reply": reply,
          ":status": "posted",
          ":updatedAt": nowIso,
          ":replyPostedAt": nowIso,
        },
        ConditionExpression: "attribute_exists(reviewId)",
      })
    );
    return true;
  } catch {
    return false;
  }
};

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as WebhookPayload;
    const reviewId = safeTrim(payload.reviewId);
    const reply = safeTrim(payload.reply);

    if (!reviewId) {
      return NextResponse.json(
        { error: "reviewId is required" },
        { status: 400 }
      );
    }

    if (!reply) {
      return NextResponse.json(
        { error: "reply is required" },
        { status: 400 }
      );
    }

    const response = await fetch(WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        reviewId,
        reply,
        reviewKey: payload.reviewKey ?? null,
        source: payload.source ?? "Google",
      }),
    });

    const result = await parseWebhookResult(response);

    if (!response.ok) {
      const message =
        typeof result === "string" && result.trim()
          ? result
          : `Webhook error (${response.status})`;
      return NextResponse.json(
        { error: message },
        { status: response.status }
      );
    }

    const reviewKey = toReviewKey(payload);
    const updated = reviewKey ? await updatePostedReply(reviewKey, reply) : false;

    return NextResponse.json({ ok: true, result, updated });
  } catch (error) {
    const typedError = error as { message?: string };
    return NextResponse.json(
      { error: typedError?.message ?? "Failed to call webhook" },
      { status: 500 }
    );
  }
}
