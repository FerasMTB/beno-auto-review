import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand } from "@aws-sdk/lib-dynamodb";

const TABLE_NAME =
  process.env.REVIEWS_TABLE ??
  process.env.AUTO_REVIEW_REVIEWS_TABLE ??
  "autoReview-reviews";
const REGION = process.env.AWS_REGION ?? "me-south-1";

const dynamoClient = new DynamoDBClient({ region: REGION });
const docClient = DynamoDBDocumentClient.from(dynamoClient);

type RawReview = {
  id?: string | number;
  reviewId?: string;
  url?: string;
  link?: string;
  reviewUrl?: string;
  title?: string;
  lang?: string;
  language?: string;
  locationId?: string | number;
  placeId?: string | number;
  publishedDate?: string;
  publishedAt?: string;
  publishedAtDate?: string;
  reviewedAt?: string;
  rating?: number | string | null;
  stars?: number | string | null;
  text?: string;
  textTranslated?: string;
  review?: string;
  reply?: string;
  status?: string;
  source?: string;
  reviewOrigin?: string;
  name?: string;
  authorName?: string;
  reviewerName?: string;
  responseFromOwnerText?: string | null;
  responseFromOwnerDate?: string | null;
  ownerResponse?: { text?: string } | null;
  placeInfo?: { id?: string | number; name?: string } | null;
  user?: { name?: string } | null;
};

type IngestResult = {
  stored: number;
  skipped: number;
  failed: number;
  errors: { id: string; message: string }[];
};

type IngestOptions = {
  defaultSource: string;
};

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

const normalizeReview = (
  review: unknown,
  nowIso: string,
  defaultSource: string
) => {
  if (!isRecord(review)) {
    throw new Error("Review must be an object");
  }

  const data = review as RawReview;
  const source =
    toString(data.reviewOrigin) ?? toString(data.source) ?? defaultSource;
  const externalId = toString(data.reviewId) ?? toString(data.id);

  if (!externalId) {
    throw new Error("Missing review id");
  }

  const rating = toNumber(data.rating) ?? toNumber(data.stars);
  const reviewedAt =
    toString(data.publishedAtDate) ??
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

  const replyText =
    toString(data.reply) ??
    toString(data.responseFromOwnerText) ??
    toString(ownerResponse?.text);
  const status =
    typeof data.status === "string" ? data.status : getDefaultStatus(rating);
  const isGoogle = source.toLowerCase() === "google";
  const placeName =
    toString(placeInfo?.name) ?? (isGoogle ? toString(data.title) : null);
  const reviewTitle = isGoogle ? null : toString(data.title);
  const authorName =
    toString(data.authorName) ??
    toString(data.reviewerName) ??
    toString(data.name) ??
    toString(user?.name);

  return {
    reviewId: `${source}#${externalId}`,
    externalId,
    source,
    reviewedAt,
    status,
    title: reviewTitle,
    review:
      toString(data.text) ??
      toString(data.textTranslated) ??
      toString(data.review),
    reply: replyText,
    rating,
    link:
      toString(data.reviewUrl) ?? toString(data.url) ?? toString(data.link),
    language: toString(data.language) ?? toString(data.lang),
    locationId: toString(data.locationId),
    placeId: toString(data.placeId) ?? toString(placeInfo?.id),
    placeName,
    authorName,
    createdAt: nowIso,
    updatedAt: nowIso,
  };
};

const storeReviews = async (
  reviews: unknown[],
  options: IngestOptions
): Promise<IngestResult> => {
  if (!TABLE_NAME) {
    throw new Error("REVIEWS_TABLE is not configured");
  }

  const nowIso = new Date().toISOString();
  const results: IngestResult = {
    stored: 0,
    skipped: 0,
    failed: 0,
    errors: [],
  };

  for (const review of reviews) {
    try {
      const item = normalizeReview(review, nowIso, options.defaultSource);

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

      const rawId =
        isRecord(review) && (review.reviewId ?? review.id)
          ? String(review.reviewId ?? review.id)
          : "unknown";
      results.failed += 1;
      results.errors.push({
        id: rawId,
        message: typedError?.message ?? "Unknown error",
      });
    }
  }

  return results;
};

export const ingestReviews = async (
  reviews: unknown[],
  options: IngestOptions
) => {
  return storeReviews(reviews, options);
};

export const extractReviewsPayload = (payload: unknown) => {
  if (Array.isArray(payload)) {
    return payload;
  }
  if (isRecord(payload) && Array.isArray(payload.reviews)) {
    return payload.reviews as unknown[];
  }
  return null;
};
