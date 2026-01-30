import { NextResponse } from "next/server";

export const runtime = "nodejs";

const WEBHOOK_URL =
  process.env.GOOGLE_REPLY_WEBHOOK_URL ??
  "https://n8n-app.stg.beno.com/webhook/post_review_reply";

type WebhookPayload = {
  reviewId?: string;
  reviewKey?: string;
  reply?: string;
  source?: string;
};

const safeTrim = (value?: string | null) => value?.trim() ?? "";

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

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as WebhookPayload;
    const reviewId = safeTrim(payload.reviewId);
    const reply = safeTrim(payload.reply);

    if (!reviewId) {
      return NextResponse.json(
        { error: "reviewId is required" },
        { status: 400 }
      );
    }

    if (!reply) {
      return NextResponse.json(
        { error: "reply is required" },
        { status: 400 }
      );
    }

    const response = await fetch(WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        reviewId,
        reply,
        reviewKey: payload.reviewKey ?? null,
        source: payload.source ?? "Google",
      }),
    });

    const result = await parseWebhookResult(response);

    if (!response.ok) {
      const message =
        typeof result === "string" && result.trim()
          ? result
          : `Webhook error (${response.status})`;
      return NextResponse.json(
        { error: message },
        { status: response.status }
      );
    }

    return NextResponse.json({ ok: true, result });
  } catch (error) {
    const typedError = error as { message?: string };
    return NextResponse.json(
      { error: typedError?.message ?? "Failed to call webhook" },
      { status: 500 }
    );
  }
}
