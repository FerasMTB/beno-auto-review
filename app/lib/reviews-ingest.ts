import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  PutCommand,
  UpdateCommand,
} from "@aws-sdk/lib-dynamodb";

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
  reviewKey?: string;
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
  reviewText?: string;
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
  updated: number;
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

const splitPrefixedId = (value: string) => {
  const hashIndex = value.indexOf("#");
  if (hashIndex <= 0 || hashIndex === value.length - 1) {
    return null;
  }
  return {
    prefix: value.slice(0, hashIndex),
    id: value.slice(hashIndex + 1),
  };
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
  const sourceFromPayload =
    toString(data.reviewOrigin) ?? toString(data.source);
  let source = sourceFromPayload ?? defaultSource;
  const rawReviewId =
    toString(data.reviewKey) ??
    toString(data.reviewId) ??
    toString(data.id);

  if (!rawReviewId) {
    throw new Error("Missing review id");
  }

  let reviewId = "";
  let externalId = rawReviewId;
  const splitId = splitPrefixedId(rawReviewId);

  if (splitId) {
    source = splitId.prefix;
    externalId = splitId.id;
    reviewId = rawReviewId;
  } else {
    reviewId = `${source}#${externalId}`;
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

  const ownerResponseText =
    toString(data.responseFromOwnerText) ?? toString(ownerResponse?.text);
  const ownerResponseDate = toString(data.responseFromOwnerDate);

  const placeInfo =
    data.placeInfo && isRecord(data.placeInfo) ? data.placeInfo : null;
  const user = data.user && isRecord(data.user) ? data.user : null;

  const isGoogle = source.toLowerCase() === "google";
  const hasOwnerResponse = isGoogle
    ? Boolean(ownerResponseText && ownerResponseDate)
    : Boolean(ownerResponseText);
  const replyText = hasOwnerResponse ? ownerResponseText : toString(data.reply);
  const replyPostedAt = hasOwnerResponse ? ownerResponseDate ?? nowIso : null;
  const status =
    typeof data.status === "string" ? data.status : getDefaultStatus(rating);
  const placeName =
    toString(placeInfo?.name) ?? (isGoogle ? toString(data.title) : null);
  const reviewTitle = isGoogle ? null : toString(data.title);
  const authorName =
    toString(data.authorName) ??
    toString(data.reviewerName) ??
    toString(data.name) ??
    toString(user?.name);

  return {
    reviewId,
    externalId,
    source,
    reviewedAt,
    status: hasOwnerResponse ? "posted" : status,
    title: reviewTitle,
    review:
      toString(data.reviewText) ??
      toString(data.text) ??
      toString(data.textTranslated) ??
      toString(data.review),
    reply: replyText,
    ...(replyPostedAt ? { replyPostedAt } : {}),
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

type NormalizedReview = ReturnType<typeof normalizeReview>;

const updateExistingReply = async (
  item: NormalizedReview,
  nowIso: string
) => {
  if (!TABLE_NAME) {
    throw new Error("REVIEWS_TABLE is not configured");
  }

  await docClient.send(
    new UpdateCommand({
      TableName: TABLE_NAME,
      Key: { reviewId: item.reviewId },
      UpdateExpression:
        "SET #reply = :reply, #status = :status, updatedAt = :updatedAt, replyPostedAt = :replyPostedAt",
      ExpressionAttributeNames: {
        "#reply": "reply",
        "#status": "status",
      },
      ExpressionAttributeValues: {
        ":reply": item.reply,
        ":status": item.status ?? "posted",
        ":updatedAt": nowIso,
        ":replyPostedAt": item.replyPostedAt ?? nowIso,
      },
      ConditionExpression: "attribute_exists(reviewId)",
    })
  );
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
    updated: 0,
    skipped: 0,
    failed: 0,
    errors: [],
  };

  for (const review of reviews) {
    let item: NormalizedReview | null = null;
    try {
      item = normalizeReview(review, nowIso, options.defaultSource);

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
        if (
          item &&
          item.reply &&
          typeof item.source === "string" &&
          item.source.toLowerCase() === "google"
        ) {
          try {
            await updateExistingReply(item, nowIso);
            results.updated += 1;
          } catch (updateError) {
            const updateTypedError = updateError as { message?: string };
            const updateId = item.externalId ?? item.reviewId ?? "unknown";
            results.failed += 1;
            results.errors.push({
              id: updateId,
              message: updateTypedError?.message ?? "Failed to update reply",
            });
          }
        } else {
          results.skipped += 1;
        }
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
