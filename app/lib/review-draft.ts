type PromptInput = {
  reviewKey: string | null;
  source: string | null;
  authorName: string | null;
  rating: number | null;
  reviewText: string | null;
  title: string | null;
  link: string | null;
};

const getOpenAiKey = () =>
  process.env.OPENAI_API_KEY ?? process.env.AMPLIFY_OPENAI_API_KEY ?? null;

const getOpenAiModel = () =>
  process.env.OPENAI_MODEL ??
  process.env.AMPLIFY_OPENAI_MODEL ??
  "gpt-4o-mini";

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

export const generateReply = async (prompt: string) => {
  const apiKey = getOpenAiKey();
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not configured");
  }

  const model = getOpenAiModel();

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
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
