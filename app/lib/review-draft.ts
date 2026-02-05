type PromptInput = {
  reviewKey: string | null;
  source: string | null;
  authorName: string | null;
  rating: number | null;
  reviewText: string | null;
  title: string | null;
  link: string | null;
};

export type GeneratedReply = {
  reply: string;
  replyOriginal: string | null;
  replyTranslated: string | null;
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

const toTrimmedString = (value: unknown): string | null => {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
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

const resolvePreferredReply = (
  replyOriginal: string | null,
  replyTranslated: string | null,
  preferredFlag: boolean | null
) => {
  if (preferredFlag === false && replyTranslated) {
    return replyTranslated;
  }
  if (preferredFlag === true && replyOriginal) {
    return replyOriginal;
  }
  return replyOriginal ?? replyTranslated ?? null;
};

const getReplyDataFromObject = (
  text: Record<string, unknown>
): GeneratedReply | null => {
  const replyOriginal = toTrimmedString(text.reply);
  const replyTranslated =
    toTrimmedString(text.reply_translated) ??
    toTrimmedString(text.replyTranslated);
  const preferredFlag =
    typeof text.in_preferd_language === "boolean"
      ? text.in_preferd_language
      : typeof text.in_preferred_language === "boolean"
        ? text.in_preferred_language
        : null;

  const preferredReply = resolvePreferredReply(
    replyOriginal,
    replyTranslated,
    preferredFlag
  );

  if (!preferredReply) {
    return null;
  }

  return {
    reply: preferredReply,
    replyOriginal,
    replyTranslated,
  };
};

const getReplyDataFromPayload = (payload: unknown): GeneratedReply | null => {
  const buildStringReply = (value: string) => {
    const trimmed = value.trim();
    if (!trimmed.length) {
      return null;
    }
    return {
      reply: trimmed,
      replyOriginal: trimmed,
      replyTranslated: null,
    };
  };

  if (Array.isArray(payload)) {
    for (const entry of payload) {
      const replyData = getReplyDataFromPayload(entry);
      if (replyData) {
        return replyData;
      }
    }
  }
  if (typeof payload === "string") {
    return buildStringReply(payload);
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
            return buildStringReply(contentItem.text);
          }
          if (
            isRecord(contentItem) &&
            contentItem.type === "output_text" &&
            isRecord(contentItem.text)
          ) {
            const replyData = getReplyDataFromObject(contentItem.text);
            if (replyData) {
              return replyData;
            }
          }
        }
      }
    }
    const directReply = getReplyDataFromObject(payload);
    if (directReply) {
      return directReply;
    }
    const replyCandidates = [
      payload.reply,
      payload.response,
      payload.text,
      payload.message,
    ];
    for (const candidate of replyCandidates) {
      if (typeof candidate === "string" && candidate.trim().length) {
        return buildStringReply(candidate);
      }
      if (isRecord(candidate)) {
        const replyData = getReplyDataFromObject(candidate);
        if (replyData) {
          return replyData;
        }
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
  reviewText: string | null,
  preferredLanguage: string | null = null
): Promise<GeneratedReply> => {
  const trimmedLanguage = toTrimmedString(preferredLanguage);
  const response = await fetch(REPLY_WEBHOOK_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      prompt,
      reviewText: reviewText ?? "",
      review: reviewText ?? "",
      preferredLanguage: trimmedLanguage ?? undefined,
      preferdLanguage: trimmedLanguage ?? undefined,
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

  const replyData = getReplyDataFromPayload(parsedBody);
  if (!replyData) {
    throw new Error("Reply webhook did not return a reply");
  }

  return replyData;
};
