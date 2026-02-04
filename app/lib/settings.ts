import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, GetCommand } from "@aws-sdk/lib-dynamodb";

const TABLE_NAME =
  process.env.SETTINGS_TABLE ??
  process.env.AUTO_REVIEW_SETTINGS_TABLE ??
  "autoReview-settings";
const REGION = process.env.AWS_REGION ?? "me-south-1";
const SETTINGS_ID = "default";

const DEFAULT_REPLY_PROMPT =
  "Write a warm, concise reply. Mention the guest by name, thank them, and reference one detail from the review. Keep under 60 words.";

const dynamoClient = new DynamoDBClient({ region: REGION });
const docClient = DynamoDBDocumentClient.from(dynamoClient);

const toPrompt = (value: unknown) => {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
};

export const getReplyPrompt = async () => {
  if (!TABLE_NAME) {
    return DEFAULT_REPLY_PROMPT;
  }

  try {
    const response = await docClient.send(
      new GetCommand({
        TableName: TABLE_NAME,
        Key: { settingId: SETTINGS_ID },
      })
    );

    return (
      toPrompt(response.Item?.replyPrompt) ?? DEFAULT_REPLY_PROMPT
    );
  } catch {
    return DEFAULT_REPLY_PROMPT;
  }
};
