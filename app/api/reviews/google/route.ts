import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { NextResponse } from "next/server";
import {
  buildUserPrompt,
  extractPromptInput,
  generateReply,
  type GeneratedReply,
} from "@/app/lib/review-draft";
import { extractReviewsPayload, ingestReviews } from "@/app/lib/reviews-ingest";
import { getReplySettings } from "@/app/lib/settings";

export const runtime = "nodejs";

const TABLE_NAME =
  process.env.REVIEWS_TABLE ??
  process.env.AUTO_REVIEW_REVIEWS_TABLE ??
  "autoReview-reviews";
const REGION = process.env.AWS_REGION ?? "me-south-1";
const POST_WEBHOOK_URL =
  process.env.GOOGLE_REPLY_WEBHOOK_URL ??
  "https://n8n-app.stg.beno.com/webhook/post_review_reply";
const AUTO_POST_THRESHOLD = 3;

const dynamoClient = new DynamoDBClient({ region: REGION });
const docClient = DynamoDBDocumentClient.from(dynamoClient);

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const toString = (value: unknown): string | null => {
  if (typeof value === "string") {
    return value.trim().length ? value : null;
  }
  if (typeof value === "number") {
    return String(value);
  }
  return null;
};

const withDefaultSource = (review: unknown, source: string) => {
  if (!isRecord(review)) {
    return review;
  }
  if (review.reviewOrigin || review.source || review.origin) {
    return review;
  }
  return { ...review, reviewOrigin: source };
};

const getRawReviewId = (review: unknown) => {
  if (!isRecord(review)) {
    return null;
  }
  return toString(review.reviewId) ?? toString(review.id);
};

const getExternalIdFromReviewKey = (reviewKey: string | null) => {
  if (!reviewKey) {
    return null;
  }
  const separatorIndex = reviewKey.indexOf("#");
  if (separatorIndex === -1) {
    return reviewKey;
  }
  return reviewKey.slice(separatorIndex + 1);
};

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

const updateDraftReply = async (
  reviewKey: string,
  reply: GeneratedReply,
  status: "draft" | "needs-review"
) => {
  if (!TABLE_NAME) {
    throw new Error("REVIEWS_TABLE is not configured");
  }

  const nowIso = new Date().toISOString();

  try {
    await docClient.send(
      new UpdateCommand({
        TableName: TABLE_NAME,
        Key: { reviewId: reviewKey },
        UpdateExpression:
          "SET #reply = :reply, #status = :status, #replyOriginal = :replyOriginal, #replyTranslated = :replyTranslated, #reviewTranslated = :reviewTranslated, updatedAt = :updatedAt, replyGeneratedAt = :replyGeneratedAt",
        ExpressionAttributeNames: {
          "#reply": "reply",
          "#status": "status",
          "#replyOriginal": "replyOriginal",
          "#replyTranslated": "replyTranslated",
          "#reviewTranslated": "reviewTranslated",
        },
        ExpressionAttributeValues: {
          ":reply": reply.reply,
          ":replyOriginal": reply.replyOriginal ?? null,
          ":replyTranslated": reply.replyTranslated ?? null,
          ":reviewTranslated": reply.reviewTranslated ?? null,
          ":status": status,
          ":updatedAt": nowIso,
          ":replyGeneratedAt": nowIso,
          ":empty": "",
          ":nullType": "NULL",
        },
        ConditionExpression:
          "attribute_exists(reviewId) AND (attribute_not_exists(#reply) OR attribute_type(#reply, :nullType) OR #reply = :empty)",
      })
    );

    return { updated: true };
  } catch (error) {
    const typedError = error as { name?: string };
    if (typedError?.name === "ConditionalCheckFailedException") {
      return { updated: false };
    }
    throw error;
  }
};

const updatePostedReply = async (reviewKey: string, reply: GeneratedReply) => {
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
          "SET #reply = :reply, #status = :status, #replyOriginal = :replyOriginal, #replyTranslated = :replyTranslated, #reviewTranslated = :reviewTranslated, updatedAt = :updatedAt, replyPostedAt = :replyPostedAt",
        ExpressionAttributeNames: {
          "#reply": "reply",
          "#status": "status",
          "#replyOriginal": "replyOriginal",
          "#replyTranslated": "replyTranslated",
          "#reviewTranslated": "reviewTranslated",
        },
        ExpressionAttributeValues: {
          ":reply": reply.reply,
          ":replyOriginal": reply.replyOriginal ?? null,
          ":replyTranslated": reply.replyTranslated ?? null,
          ":reviewTranslated": reply.reviewTranslated ?? null,
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

const postReply = async (
  reviewId: string,
  reply: string,
  reviewKey: string | null
) => {
  const response = await fetch(POST_WEBHOOK_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      reviewId,
      reply,
      reviewKey,
      source: "Google",
    }),
  });

  const result = await parseWebhookResult(response);
  if (!response.ok) {
    const message =
      typeof result === "string" && result.trim().length
        ? result
        : `Webhook error (${response.status})`;
    throw new Error(message);
  }

  return result;
};

const autoGenerateReplies = async (
  reviews: unknown[],
  settingsPrompt: string | null,
  preferredLanguage: string | null
) => {
  const results = {
    processed: 0,
    drafted: 0,
    posted: 0,
    skipped: 0,
    failed: 0,
    errors: [] as { id: string; message: string }[],
  };

  for (const review of reviews) {
    results.processed += 1;
    try {
      const prepared = withDefaultSource(review, "Google");
      const input = extractPromptInput(prepared);

      if (!input.reviewKey) {
        results.skipped += 1;
        continue;
      }

      const prompt = buildUserPrompt(input, settingsPrompt);
      const replyData = await generateReply(
        prompt,
        input.reviewText,
        preferredLanguage
      );

      const status =
        input.rating !== null && input.rating < AUTO_POST_THRESHOLD
          ? "needs-review"
          : "draft";
      const updateResult = await updateDraftReply(
        input.reviewKey,
        replyData,
        status
      );

      if (!updateResult.updated) {
        results.skipped += 1;
        continue;
      }

      results.drafted += 1;

      const shouldAutoPost =
        input.rating !== null && input.rating >= AUTO_POST_THRESHOLD;

      if (!shouldAutoPost) {
        continue;
      }

      const rawReviewId =
        getRawReviewId(prepared) ?? getExternalIdFromReviewKey(input.reviewKey);
      if (!rawReviewId) {
        results.skipped += 1;
        continue;
      }

      await postReply(rawReviewId, replyData.reply, input.reviewKey);
      const posted = await updatePostedReply(input.reviewKey, replyData);
      if (posted) {
        results.posted += 1;
      }
    } catch (error) {
      results.failed += 1;
      const rawId =
        isRecord(review) && (review.reviewId ?? review.id)
          ? String(review.reviewId ?? review.id)
          : "unknown";
      results.errors.push({
        id: rawId,
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  return results;
};

export async function POST(request: Request) {
  let payload: unknown;

  try {
    payload = await request.json();
  } catch {
    return NextResponse.json(
      { message: "Invalid JSON payload" },
      { status: 400 }
    );
  }

  const reviews = extractReviewsPayload(payload);
  if (!reviews) {
    return NextResponse.json(
      { message: "Payload must be an array or { reviews: [] }" },
      { status: 400 }
    );
  }

  try {
    const results = await ingestReviews(reviews, { defaultSource: "Google" });
    const replySettings = await getReplySettings();
    const automation = await autoGenerateReplies(
      reviews,
      replySettings.prompt,
      replySettings.preferredLanguage
    );
    return NextResponse.json(
      { ok: true, ...results, automation },
      { status: 200 }
    );
  } catch (error) {
    const typedError = error as { message?: string };
    return NextResponse.json(
      {
        message: "Failed to store Google reviews",
        error: typedError?.message ?? "Unknown error",
      },
      { status: 500 }
    );
  }
}
