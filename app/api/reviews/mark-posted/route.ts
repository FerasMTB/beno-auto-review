import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

const TABLE_NAME =
  process.env.REVIEWS_TABLE ??
  process.env.AUTO_REVIEW_REVIEWS_TABLE ??
  "autoReview-reviews";
const REGION = process.env.AWS_REGION ?? "me-south-1";

const dynamoClient = new DynamoDBClient({ region: REGION });
const docClient = DynamoDBDocumentClient.from(dynamoClient);

type MarkPostedPayload = {
  reviewId?: string;
  reviewKey?: string;
  source?: string;
  reply?: string | null;
};

const safeTrim = (value?: string | null) => value?.trim() ?? "";

const toReviewKey = (payload: MarkPostedPayload) => {
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
  const source = safeTrim(payload.source) || "TripAdvisor";
  return `${source}#${reviewId}`;
};

export async function POST(request: Request) {
  if (!TABLE_NAME) {
    return NextResponse.json(
      { error: "REVIEWS_TABLE is not configured" },
      { status: 500 }
    );
  }

  try {
    const payload = (await request.json()) as MarkPostedPayload;
    const reviewKey = toReviewKey(payload);

    if (!reviewKey) {
      return NextResponse.json(
        { error: "reviewId is required" },
        { status: 400 }
      );
    }

    const nowIso = new Date().toISOString();
    const reply = safeTrim(payload.reply);
    const hasReply = reply.length > 0;

    const updateExpression = hasReply
      ? "SET #reply = :reply, #status = :status, updatedAt = :updatedAt, replyPostedAt = :replyPostedAt"
      : "SET #status = :status, updatedAt = :updatedAt, replyPostedAt = :replyPostedAt";

    const expressionAttributeNames = hasReply
      ? { "#reply": "reply", "#status": "status" }
      : { "#status": "status" };

    const expressionAttributeValues = hasReply
      ? {
          ":reply": reply,
          ":status": "posted",
          ":updatedAt": nowIso,
          ":replyPostedAt": nowIso,
        }
      : {
          ":status": "posted",
          ":updatedAt": nowIso,
          ":replyPostedAt": nowIso,
        };

    await docClient.send(
      new UpdateCommand({
        TableName: TABLE_NAME,
        Key: { reviewId: reviewKey },
        UpdateExpression: updateExpression,
        ExpressionAttributeNames: expressionAttributeNames,
        ExpressionAttributeValues: expressionAttributeValues,
        ConditionExpression: "attribute_exists(reviewId)",
      })
    );

    return NextResponse.json({ ok: true });
  } catch (error) {
    const typedError = error as { message?: string };
    return NextResponse.json(
      { error: typedError?.message ?? "Failed to mark as posted" },
      { status: 500 }
    );
  }
}
