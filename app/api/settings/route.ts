import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
} from "@aws-sdk/lib-dynamodb";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

const TABLE_NAME =
  process.env.SETTINGS_TABLE ??
  process.env.AUTO_REVIEW_SETTINGS_TABLE ??
  "autoReview-settings";
const REGION = process.env.AWS_REGION ?? "me-south-1";
const SETTINGS_ID = "default";

const dynamoClient = new DynamoDBClient({ region: REGION });
const docClient = DynamoDBDocumentClient.from(dynamoClient);

type SettingsRecord = {
  settingId: string;
  googleMapsUrl: string;
  tripAdvisorUrl: string;
  syncTime: string;
  replyPrompt: string;
  preferredLanguage: string;
  autoDraftReplies: boolean;
  autoPostHighStars: boolean;
  holdLowStars: boolean;
  replyTone: string;
  approvalThreshold: string;
  autoPostDelay: string;
  createdAt?: string;
  updatedAt?: string;
};

const DEFAULT_SETTINGS: SettingsRecord = {
  settingId: SETTINGS_ID,
  googleMapsUrl: "https://maps.google.com/?q=place",
  tripAdvisorUrl: "https://www.tripadvisor.com/",
  syncTime: "2:00 AM",
  replyPrompt:
    "Write a warm, concise reply. Mention the guest by name, thank them, and reference one detail from the review. Keep under 60 words.",
  preferredLanguage: "English",
  autoDraftReplies: true,
  autoPostHighStars: false,
  holdLowStars: true,
  replyTone: "Warm and professional",
  approvalThreshold: "3 stars and below",
  autoPostDelay: "30 minutes",
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const toString = (value: unknown): string | null => {
  if (typeof value === "string") {
    return value.trim().length ? value : null;
  }
  return null;
};

const toBoolean = (value: unknown): boolean | null => {
  if (typeof value === "boolean") {
    return value;
  }
  return null;
};

const pickSettings = (payload: unknown) => {
  if (!isRecord(payload)) {
    throw new Error("Settings payload must be an object");
  }

  const data = payload as Record<string, unknown>;
  const result: Partial<SettingsRecord> = {};

  const googleMapsUrl = toString(data.googleMapsUrl);
  if (googleMapsUrl) {
    result.googleMapsUrl = googleMapsUrl;
  }

  const tripAdvisorUrl = toString(data.tripAdvisorUrl);
  if (tripAdvisorUrl) {
    result.tripAdvisorUrl = tripAdvisorUrl;
  }

  const syncTime = toString(data.syncTime);
  if (syncTime) {
    result.syncTime = syncTime;
  }

  const replyPrompt = toString(data.replyPrompt);
  if (replyPrompt) {
    result.replyPrompt = replyPrompt;
  }

  const preferredLanguage = toString(data.preferredLanguage);
  if (preferredLanguage) {
    result.preferredLanguage = preferredLanguage;
  }

  const replyTone = toString(data.replyTone);
  if (replyTone) {
    result.replyTone = replyTone;
  }

  const approvalThreshold = toString(data.approvalThreshold);
  if (approvalThreshold) {
    result.approvalThreshold = approvalThreshold;
  }

  const autoPostDelay = toString(data.autoPostDelay);
  if (autoPostDelay) {
    result.autoPostDelay = autoPostDelay;
  }

  const autoDraftReplies = toBoolean(data.autoDraftReplies);
  if (autoDraftReplies !== null) {
    result.autoDraftReplies = autoDraftReplies;
  }

  const autoPostHighStars = toBoolean(data.autoPostHighStars);
  if (autoPostHighStars !== null) {
    result.autoPostHighStars = autoPostHighStars;
  }

  const holdLowStars = toBoolean(data.holdLowStars);
  if (holdLowStars !== null) {
    result.holdLowStars = holdLowStars;
  }

  return result;
};

export async function GET() {
  if (!TABLE_NAME) {
    return NextResponse.json(
      { message: "SETTINGS_TABLE is not configured" },
      { status: 500 }
    );
  }

  try {
    const response = await docClient.send(
      new GetCommand({
        TableName: TABLE_NAME,
        Key: { settingId: SETTINGS_ID },
      })
    );

    const settings = {
      ...DEFAULT_SETTINGS,
      ...(response.Item ?? {}),
    };

    return NextResponse.json({ ok: true, settings });
  } catch (error) {
    const typedError = error as { message?: string };
    return NextResponse.json(
      {
        message: "Failed to load settings",
        error: typedError?.message ?? "Unknown error",
      },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  if (!TABLE_NAME) {
    return NextResponse.json(
      { message: "SETTINGS_TABLE is not configured" },
      { status: 500 }
    );
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json(
      { message: "Invalid JSON payload" },
      { status: 400 }
    );
  }

  try {
    const incoming = pickSettings(payload);
    const nowIso = new Date().toISOString();

    const existing = await docClient.send(
      new GetCommand({
        TableName: TABLE_NAME,
        Key: { settingId: SETTINGS_ID },
      })
    );

    const createdAt =
      typeof existing.Item?.createdAt === "string"
        ? existing.Item.createdAt
        : nowIso;

    const item: SettingsRecord = {
      ...DEFAULT_SETTINGS,
      ...(existing.Item ?? {}),
      ...incoming,
      settingId: SETTINGS_ID,
      createdAt,
      updatedAt: nowIso,
    };

    await docClient.send(
      new PutCommand({
        TableName: TABLE_NAME,
        Item: item,
      })
    );

    return NextResponse.json({ ok: true, settings: item }, { status: 200 });
  } catch (error) {
    const typedError = error as { message?: string };
    return NextResponse.json(
      {
        message: "Failed to save settings",
        error: typedError?.message ?? "Unknown error",
      },
      { status: 500 }
    );
  }
}
