import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  ScanCommand,
  UpdateCommand,
} from "@aws-sdk/lib-dynamodb";
import { NextResponse } from "next/server";
import {
  buildUserPrompt,
  extractPromptInput,
  generateReply,
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

const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 25;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const parseLimit = (value: unknown) => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.min(Math.max(value, 1), MAX_LIMIT);
  }
  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return Math.min(Math.max(parsed, 1), MAX_LIMIT);
    }
  }
  return DEFAULT_LIMIT;
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
  if (!TABLE_NAME) {
    return NextResponse.json(
      { message: "REVIEWS_TABLE is not configured" },
      { status: 500 }
    );
  }

  let payload: unknown = null;

  try {
    payload = await request.json();
  } catch {
    payload = null;
  }

  const limit = isRecord(payload) ? parseLimit(payload.limit) : DEFAULT_LIMIT;
  const promptOverride =
    isRecord(payload) && typeof payload.prompt === "string"
      ? payload.prompt.trim() || null
      : null;

  try {
    const response = await docClient.send(
      new ScanCommand({
        TableName: TABLE_NAME,
        FilterExpression:
          "attribute_not_exists(#reply) OR attribute_type(#reply, :nullType) OR #reply = :empty",
        ExpressionAttributeNames: {
          "#reply": "reply",
        },
        ExpressionAttributeValues: {
          ":nullType": "NULL",
          ":empty": "",
        },
        Limit: limit,
      })
    );

    const items = (response.Items as Record<string, unknown>[] | undefined) ?? [];
    const replySettings = items.length > 0 ? await getReplySettings() : null;
    const settingsPrompt =
      items.length > 0 && !promptOverride ? replySettings?.prompt ?? null : null;
    const preferredLanguage = replySettings?.preferredLanguage ?? null;
    const results = {
      scanned: items.length,
      processed: 0,
      drafted: 0,
      skipped: 0,
      failed: 0,
      errors: [] as { id: string; message: string }[],
    };

    for (const item of items) {
      results.processed += 1;
      try {
        const input = extractPromptInput(item);
        if (!input.reviewKey) {
          results.skipped += 1;
          continue;
        }

        const prompt = buildUserPrompt(input, promptOverride ?? settingsPrompt);
        const reply = await generateReply(
          prompt,
          input.reviewText,
          preferredLanguage
        );
        const updateResult = await updateReply(input.reviewKey, reply);

        if (updateResult.updated) {
          results.drafted += 1;
        } else {
          results.skipped += 1;
        }
      } catch (error) {
        results.failed += 1;
        results.errors.push({
          id:
            isRecord(item) && typeof item.reviewId === "string"
              ? item.reviewId
              : "unknown",
          message: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }

    return NextResponse.json({ ok: true, ...results }, { status: 200 });
  } catch (error) {
    const typedError = error as { message?: string };
    return NextResponse.json(
      {
        message: "Failed to draft replies",
        error: typedError?.message ?? "Unknown error",
      },
      { status: 500 }
    );
  }
}
