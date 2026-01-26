import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

const TABLE_NAME =
  process.env.REVIEWS_TABLE ??
  process.env.AUTO_REVIEW_REVIEWS_TABLE ??
  "autoReview-reviews";
const REGION = process.env.AWS_REGION ?? "us-east-1";
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_MODEL = process.env.OPENAI_MODEL ?? "gpt-4o-mini";

const DEFAULT_PROMPT =
  "Write a warm, concise reply. Mention the guest by name when available, thank them, and reference one detail from the review. Keep under 60 words. If the rating is 3 or lower, acknowledge the issue and invite them to contact support.";

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

type PromptInput = {
  reviewKey: string | null;
  source: string | null;
  authorName: string | null;
  rating: number | null;
  reviewText: string | null;
  title: string | null;
  link: string | null;
};

const extractPromptInput = (payload: unknown): PromptInput => {
  if (!isRecord(payload)) {
    throw new Error("Review must be an object");
  }

  const review = payload as Record<string, unknown>;
  const source =
    toString(review.reviewOrigin) ??
    toString(review.source) ??
    toString(review.origin) ??
    null;

  const rawReviewId = toString(review.reviewId) ?? toString(review.id);
  const reviewKey = rawReviewId
    ? rawReviewId.includes("#")
      ? rawReviewId
      : source
        ? `${source}#${rawReviewId}`
        : null
    : null;

  const authorName =
    toString(review.authorName) ??
    toString(review.author) ??
    toString(review.name) ??
    toString(review.reviewerName) ??
    (isRecord(review.user) ? toString(review.user.name) : null);

  const rating = toNumber(review.rating) ?? toNumber(review.stars);
  const reviewText =
    toString(review.review) ??
    toString(review.text) ??
    toString(review.textTranslated);
  const title = toString(review.title);
  const link =
    toString(review.reviewUrl) ?? toString(review.url) ?? toString(review.link);

  return {
    reviewKey,
    source,
    authorName,
    rating,
    reviewText,
    title,
    link,
  };
};

const buildUserPrompt = (input: PromptInput, customPrompt?: string | null) => {
  const lines = [
    `Source: ${input.source ?? "Unknown"}`,
    `Reviewer: ${input.authorName ?? "Guest"}`,
    `Rating: ${input.rating ?? "N/A"}`,
    `Title: ${input.title ?? "N/A"}`,
    `Review: ${input.reviewText ?? "(no text provided)"}`,
  ];

  return `${customPrompt ?? DEFAULT_PROMPT}\n\nReview details:\n${lines.join(
    "\n"
  )}\n\nReply:`;
};

const generateReply = async (prompt: string) => {
  if (!OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is not configured");
  }

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: OPENAI_MODEL,
      messages: [
        {
          role: "system",
          content:
            "You write polite, brand-safe replies to customer reviews. Keep replies concise and professional.",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
      temperature: 0.4,
      max_tokens: 180,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenAI error: ${response.status} ${errorText}`);
  }

  const data = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };

  const content = data.choices?.[0]?.message?.content?.trim();
  if (!content) {
    throw new Error("OpenAI did not return a reply");
  }

  return content;
};

const updateReply = async (reviewKey: string, reply: string) => {
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
          ":status": "draft",
          ":updatedAt": nowIso,
          ":replyGeneratedAt": nowIso,
        },
        ConditionExpression: "attribute_exists(reviewId)",
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

  const reviewPayload =
    isRecord(payload) && payload.review ? payload.review : payload;
  const promptOverride =
    isRecord(payload) && typeof payload.prompt === "string"
      ? payload.prompt
      : null;

  try {
    const input = extractPromptInput(reviewPayload);
    const prompt = buildUserPrompt(input, promptOverride);
    const reply = await generateReply(prompt);

    const updateResult =
      input.reviewKey !== null ? await updateReply(input.reviewKey, reply) : null;

    return NextResponse.json(
      {
        ok: true,
        reply,
        reviewId: input.reviewKey,
        updated: updateResult?.updated ?? false,
      },
      { status: 200 }
    );
  } catch (error) {
    const typedError = error as { message?: string };
    return NextResponse.json(
      {
        message: "Failed to draft reply",
        error: typedError?.message ?? "Unknown error",
      },
      { status: 500 }
    );
  }
}
