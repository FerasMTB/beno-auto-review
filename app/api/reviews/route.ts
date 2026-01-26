import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  QueryCommand,
  ScanCommand,
} from "@aws-sdk/lib-dynamodb";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

const TABLE_NAME =
  process.env.REVIEWS_TABLE ??
  process.env.AUTO_REVIEW_REVIEWS_TABLE ??
  "autoReview-reviews";
const REGION = process.env.AWS_REGION ?? "me-south-1";

const dynamoClient = new DynamoDBClient({ region: REGION });
const docClient = DynamoDBDocumentClient.from(dynamoClient);

const parseLimit = (value: string | null) => {
  const parsed = value ? Number(value) : NaN;
  if (Number.isFinite(parsed) && parsed > 0) {
    return Math.min(parsed, 100);
  }
  return 25;
};

const sortByReviewedAt = (items: Record<string, unknown>[]) => {
  return items.sort((a, b) => {
    const aValue = typeof a.reviewedAt === "string" ? a.reviewedAt : "";
    const bValue = typeof b.reviewedAt === "string" ? b.reviewedAt : "";
    if (aValue === bValue) {
      return 0;
    }
    return aValue > bValue ? -1 : 1;
  });
};

export async function GET(request: Request) {
  if (!TABLE_NAME) {
    return NextResponse.json(
      { message: "REVIEWS_TABLE is not configured" },
      { status: 500 }
    );
  }

  const { searchParams } = new URL(request.url);
  const limit = parseLimit(searchParams.get("limit"));
  const status = searchParams.get("status");
  const source = searchParams.get("source");

  try {
    if (status) {
      const response = await docClient.send(
        new QueryCommand({
          TableName: TABLE_NAME,
          IndexName: "status-index",
          KeyConditionExpression: "#status = :status",
          ExpressionAttributeNames: { "#status": "status" },
          ExpressionAttributeValues: { ":status": status },
          Limit: limit,
          ScanIndexForward: false,
        })
      );

      return NextResponse.json({
        ok: true,
        items: response.Items ?? [],
        count: response.Count ?? 0,
      });
    }

    if (source) {
      const response = await docClient.send(
        new QueryCommand({
          TableName: TABLE_NAME,
          IndexName: "source-index",
          KeyConditionExpression: "#source = :source",
          ExpressionAttributeNames: { "#source": "source" },
          ExpressionAttributeValues: { ":source": source },
          Limit: limit,
          ScanIndexForward: false,
        })
      );

      return NextResponse.json({
        ok: true,
        items: response.Items ?? [],
        count: response.Count ?? 0,
      });
    }

    const response = await docClient.send(
      new ScanCommand({
        TableName: TABLE_NAME,
        Limit: limit,
      })
    );

    const items = sortByReviewedAt(
      (response.Items as Record<string, unknown>[] | undefined) ?? []
    );

    return NextResponse.json({
      ok: true,
      items,
      count: response.Count ?? items.length,
    });
  } catch (error) {
    const typedError = error as { message?: string };
    return NextResponse.json(
      {
        message: "Failed to load reviews",
        error: typedError?.message ?? "Unknown error",
      },
      { status: 500 }
    );
  }
}
