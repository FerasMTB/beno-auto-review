import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { NextResponse } from "next/server";
import {
  buildUserPrompt,
  extractPromptInput,
  generateReply,
} from "@/app/lib/review-draft";

export const runtime = "nodejs";

const TABLE_NAME =
  process.env.REVIEWS_TABLE ??
  process.env.AUTO_REVIEW_REVIEWS_TABLE ??
  "autoReview-reviews";
const REGION = process.env.AWS_REGION ?? "me-south-1";

const dynamoClient = new DynamoDBClient({ region: REGION });
const docClient = DynamoDBDocumentClient.from(dynamoClient);

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

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
    const reply = await generateReply(prompt, input.reviewText);

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
