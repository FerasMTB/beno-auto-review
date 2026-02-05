import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { NextResponse } from "next/server";
import {
  buildUserPrompt,
  buildChangePrompt,
  extractPromptInput,
  generateReply,
  type GeneratedReply,
} from "@/app/lib/review-draft";
import { getReplySettings } from "@/app/lib/settings";

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

const updateReply = async (reviewKey: string, reply: GeneratedReply) => {
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
          "SET #reply = :reply, #status = :status, #replyOriginal = :replyOriginal, #replyTranslated = :replyTranslated, #reviewTranslated = :reviewTranslated, updatedAt = :updatedAt, replyGeneratedAt = :replyGeneratedAt",
        ExpressionAttributeNames: {
          "#reply": "reply",
          "#status": "status",
          "#replyOriginal": "replyOriginal",
          "#replyTranslated": "replyTranslated",
          "#reviewTranslated": "reviewTranslated",
        },
        ExpressionAttributeValues: {
          ":reply": reply.reply,
          ":replyOriginal": reply.replyOriginal ?? null,
          ":replyTranslated": reply.replyTranslated ?? null,
          ":reviewTranslated": reply.reviewTranslated ?? null,
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
      ? payload.prompt.trim() || null
      : null;
  const askForChanges =
    isRecord(payload) &&
    (typeof payload.ask_for_changes === "boolean" ||
      typeof payload.need_changes === "boolean")
      ? Boolean(payload.ask_for_changes ?? payload.need_changes)
      : false;
  const changeRequest =
    isRecord(payload) && typeof payload.changes === "string"
      ? payload.changes.trim()
      : null;
  const previousReply =
    isRecord(payload) && typeof payload.previousReply === "string"
      ? payload.previousReply.trim()
      : null;

  try {
    const input = extractPromptInput(reviewPayload);
    const replySettings = await getReplySettings();
    const settingsPrompt = promptOverride ? null : replySettings.prompt;
    const prompt =
      askForChanges && promptOverride
        ? promptOverride
        : askForChanges && changeRequest && previousReply
          ? buildChangePrompt(
              input,
              previousReply,
              changeRequest,
              promptOverride ?? settingsPrompt,
              replySettings.preferredLanguage
            )
          : buildUserPrompt(
              input,
              promptOverride ?? settingsPrompt,
              replySettings.preferredLanguage
            );
    const replyData = await generateReply(
      prompt,
      input.reviewText,
      replySettings.preferredLanguage,
      askForChanges
        ? {
            needChanges: true,
            askForChanges: true,
            previousReply,
          }
        : {}
    );

    const updateResult =
      input.reviewKey !== null ? await updateReply(input.reviewKey, replyData) : null;

    return NextResponse.json(
      {
        ok: true,
        reply: replyData.reply,
        replyOriginal: replyData.replyOriginal,
        replyTranslated: replyData.replyTranslated,
        reviewTranslated: replyData.reviewTranslated,
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
