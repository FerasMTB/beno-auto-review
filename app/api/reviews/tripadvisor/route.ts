import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { NextResponse } from "next/server";
import {
  buildUserPrompt,
  extractPromptInput,
  generateReply,
} from "@/app/lib/review-draft";
import { extractReviewsPayload, ingestReviews } from "@/app/lib/reviews-ingest";

export const runtime = "nodejs";

const TABLE_NAME =
  process.env.REVIEWS_TABLE ??
  process.env.AUTO_REVIEW_REVIEWS_TABLE ??
  "autoReview-reviews";
const REGION = process.env.AWS_REGION ?? "me-south-1";
const AUTO_POST_THRESHOLD = 3;

const dynamoClient = new DynamoDBClient({ region: REGION });
const docClient = DynamoDBDocumentClient.from(dynamoClient);

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const withDefaultSource = (review: unknown, source: string) => {
  if (!isRecord(review)) {
    return review;
  }
  if (review.reviewOrigin || review.source || review.origin) {
    return review;
  }
  return { ...review, reviewOrigin: source };
};

const updateDraftReply = async (
  reviewKey: string,
  reply: string,
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
          "SET #reply = :reply, #status = :status, updatedAt = :updatedAt, replyGeneratedAt = :replyGeneratedAt",
        ExpressionAttributeNames: {
          "#reply": "reply",
          "#status": "status",
        },
        ExpressionAttributeValues: {
          ":reply": reply,
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

const autoGenerateReplies = async (reviews: unknown[]) => {
  const results = {
    processed: 0,
    drafted: 0,
    skipped: 0,
    failed: 0,
    errors: [] as { id: string; message: string }[],
  };

  for (const review of reviews) {
    results.processed += 1;
    try {
      const prepared = withDefaultSource(review, "TripAdvisor");
      const input = extractPromptInput(prepared);

      if (!input.reviewKey) {
        results.skipped += 1;
        continue;
      }

      const prompt = buildUserPrompt(input);
      const reply = await generateReply(prompt, input.reviewText);

      const status =
        input.rating !== null && input.rating < AUTO_POST_THRESHOLD
          ? "needs-review"
          : "draft";
      const updateResult = await updateDraftReply(
        input.reviewKey,
        reply,
        status
      );

      if (updateResult.updated) {
        results.drafted += 1;
      } else {
        results.skipped += 1;
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
    const results = await ingestReviews(reviews, {
      defaultSource: "TripAdvisor",
    });
    const automation = await autoGenerateReplies(reviews);
    return NextResponse.json(
      { ok: true, ...results, automation },
      { status: 200 }
    );
  } catch (error) {
    const typedError = error as { message?: string };
    return NextResponse.json(
      {
        message: "Failed to store TripAdvisor reviews",
        error: typedError?.message ?? "Unknown error",
      },
      { status: 500 }
    );
  }
}
