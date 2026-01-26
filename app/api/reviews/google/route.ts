import { NextResponse } from "next/server";
import { extractReviewsPayload, ingestReviews } from "@/app/lib/reviews-ingest";

export const runtime = "nodejs";

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
    return NextResponse.json({ ok: true, ...results }, { status: 200 });
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
