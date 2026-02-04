type PromptInput = {
  reviewKey: string | null;
  source: string | null;
  authorName: string | null;
  rating: number | null;
  reviewText: string | null;
  title: string | null;
  link: string | null;
};

const REPLY_WEBHOOK_URL =
  process.env.REPLY_WEBHOOK_URL ??
  "https://n8n-app.stg.beno.com/webhook/generate-reply";

const DEFAULT_PROMPT =
  "Write a warm, concise reply. Mention the guest by name when available, thank them, and reference one detail from the review. Keep under 60 words. If the rating is 3 or lower, acknowledge the issue and invite them to contact support.";

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

const WORD_NUMBERS: Record<string, number> = {
  zero: 0,
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
};

const extractNumber = (value: string): number | null => {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  const numericMatch = trimmed.match(/-?\d+(?:\.\d+)?/);
  if (numericMatch) {
    const parsed = Number(numericMatch[0]);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  const normalized = trimmed.toLowerCase();
  if (normalized in WORD_NUMBERS) {
    return WORD_NUMBERS[normalized];
  }

  const wordMatch = normalized.match(/\b(zero|one|two|three|four|five)\b/);
  if (wordMatch) {
    return WORD_NUMBERS[wordMatch[1]];
  }

  return null;
};

const toNumber = (value: unknown): number | null => {
  if (typeof value === "number") {
    return value;
  }
  if (typeof value === "string") {
    return extractNumber(value);
  }
  return null;
};

export const extractPromptInput = (payload: unknown): PromptInput => {
  if (!isRecord(payload)) {
    throw new Error("Review must be an object");
  }

  const review = payload as Record<string, unknown>;
  const source =
    toString(review.reviewOrigin) ??
    toString(review.source) ??
    toString(review.origin) ??
    null;

  const rawReviewId =
    toString(review.reviewKey) ??
    toString(review.reviewId) ??
    toString(review.id);
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
    toString(review.reviewText) ??
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

export const buildUserPrompt = (
  input: PromptInput,
  customPrompt?: string | null
) => {
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

const getReplyFromPayload = (payload: unknown): string | null => {
  if (Array.isArray(payload)) {
    for (const entry of payload) {
      const reply = getReplyFromPayload(entry);
      if (reply) {
        return reply;
      }
    }
  }
  if (typeof payload === "string") {
    return payload.trim().length ? payload.trim() : null;
  }
  if (isRecord(payload)) {
    if (Array.isArray(payload.output)) {
      for (const outputItem of payload.output) {
        if (!isRecord(outputItem) || !Array.isArray(outputItem.content)) {
          continue;
        }
        for (const contentItem of outputItem.content) {
          if (
            isRecord(contentItem) &&
            contentItem.type === "output_text" &&
            typeof contentItem.text === "string" &&
            contentItem.text.trim().length
          ) {
            return contentItem.text.trim();
          }
        }
      }
    }
    const replyCandidates = [
      payload.reply,
      payload.response,
      payload.text,
      payload.message,
    ];
    for (const candidate of replyCandidates) {
      if (typeof candidate === "string" && candidate.trim().length) {
        return candidate.trim();
      }
    }
  }
  return null;
};

const getErrorFromPayload = (payload: unknown) => {
  if (typeof payload === "string") {
    return payload.trim().length ? payload.trim() : null;
  }
  if (isRecord(payload)) {
    if (typeof payload.error === "string") {
      return payload.error;
    }
    if (isRecord(payload.error) && typeof payload.error.message === "string") {
      return payload.error.message;
    }
    if (typeof payload.message === "string") {
      return payload.message;
    }
  }
  return null;
};

export const generateReply = async (
  prompt: string,
  reviewText: string | null
) => {
  const response = await fetch(REPLY_WEBHOOK_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      prompt,
      reviewText: reviewText ?? "",
    }),
  });

  const rawBody = await response.text();
  let parsedBody: unknown = rawBody;

  if (rawBody) {
    try {
      parsedBody = JSON.parse(rawBody) as unknown;
    } catch {
      parsedBody = rawBody;
    }
  }

  if (!response.ok) {
    const errorText =
      getErrorFromPayload(parsedBody) ??
      (rawBody ? rawBody : `Webhook error (${response.status})`);
    throw new Error(errorText);
  }

  const reply = getReplyFromPayload(parsedBody);
  if (!reply) {
    throw new Error("Reply webhook did not return a reply");
  }

  return reply;
};
