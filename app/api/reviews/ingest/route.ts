import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand } from "@aws-sdk/lib-dynamodb";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

const TABLE_NAME =
  process.env.REVIEWS_TABLE ?? process.env.AUTO_REVIEW_REVIEWS_TABLE;
const REGION = process.env.AWS_REGION ?? "us-east-1";

const dynamoClient = new DynamoDBClient({ region: REGION });
const docClient = DynamoDBDocumentClient.from(dynamoClient);

type RawReview = {
  id?: string | number;
  url?: string;
  link?: string;
  title?: string;
  lang?: string;
  locationId?: string | number;
  publishedDate?: string;
  publishedAt?: string;
  reviewedAt?: string;
  rating?: number | string | null;
  text?: string;
  review?: string;
  reply?: string;
  status?: string;
  source?: string;
  ownerResponse?: { text?: string } | null;
  placeInfo?: { id?: string | number; name?: string } | null;
  user?: { name?: string } | null;
};

const DEFAULT_SOURCE = "TripAdvisor";

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

const toNumber = (value: unknown): number | null => {
  if (typeof value === "number") {
    return value;
  }
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
};

const getDefaultStatus = (rating: number | null) => {
  if (rating !== null && rating <= 3) {
    return "needs-review";
  }
  return "draft";
};

const normalizeReview = (review: unknown, nowIso: string) => {
  if (!isRecord(review)) {
    throw new Error("Review must be an object");
  }

  const data = review as RawReview;
  const source = typeof data.source === "string" ? data.source : DEFAULT_SOURCE;
  const externalId = toString(data.id);

  if (!externalId) {
    throw new Error("Missing review id");
  }

  const rating = toNumber(data.rating);
  const reviewedAt =
    toString(data.publishedDate) ??
    toString(data.publishedAt) ??
    toString(data.reviewedAt) ??
    nowIso;

  const ownerResponse =
    data.ownerResponse && isRecord(data.ownerResponse)
      ? data.ownerResponse
      : null;

  const placeInfo =
    data.placeInfo && isRecord(data.placeInfo) ? data.placeInfo : null;
  const user = data.user && isRecord(data.user) ? data.user : null;

  const replyText = toString(data.reply) ?? toString(ownerResponse?.text);
  const status =
    typeof data.status === "string" ? data.status : getDefaultStatus(rating);

  return {
    reviewId: `${source}#${externalId}`,
    externalId,
    source,
    reviewedAt,
    status,
    title: toString(data.title),
    review: toString(data.text) ?? toString(data.review),
    reply: replyText,
    rating,
    link: toString(data.url) ?? toString(data.link),
    language: toString(data.lang),
    locationId: toString(data.locationId),
    placeId: toString(placeInfo?.id),
    placeName: toString(placeInfo?.name),
    authorName: toString(user?.name),
    createdAt: nowIso,
    updatedAt: nowIso,
  };
};

const storeReviews = async (reviews: unknown[]) => {
  if (!TABLE_NAME) {
    throw new Error("REVIEWS_TABLE is not configured");
  }

  const nowIso = new Date().toISOString();
  const results = {
    stored: 0,
    skipped: 0,
    failed: 0,
    errors: [] as { id: string; message: string }[],
  };

  for (const review of reviews) {
    try {
      const item = normalizeReview(review, nowIso);

      await docClient.send(
        new PutCommand({
          TableName: TABLE_NAME,
          Item: item,
          ConditionExpression: "attribute_not_exists(reviewId)",
        })
      );

      results.stored += 1;
    } catch (error) {
      const typedError = error as { name?: string; message?: string };
      if (typedError?.name === "ConditionalCheckFailedException") {
        results.skipped += 1;
        continue;
      }

      results.failed += 1;
      results.errors.push({
        id: isRecord(review) && review.id ? String(review.id) : "unknown",
        message: typedError?.message ?? "Unknown error",
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

  const reviews = Array.isArray(payload)
    ? payload
    : isRecord(payload) && Array.isArray(payload.reviews)
      ? payload.reviews
      : null;

  if (!reviews) {
    return NextResponse.json(
      { message: "Payload must be an array or { reviews: [] }" },
      { status: 400 }
    );
  }

  try {
    const results = await storeReviews(reviews);
    return NextResponse.json({ ok: true, ...results }, { status: 200 });
  } catch (error) {
    const typedError = error as { message?: string };
    return NextResponse.json(
      {
        message: "Failed to store reviews",
        error: typedError?.message ?? "Unknown error",
      },
      { status: 500 }
    );
  }
}
