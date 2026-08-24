import type {
  APIGatewayProxyEvent,
  APIGatewayProxyResult,
} from "aws-lambda";
import { parseResumeCore, PdfParseError } from "../core/parseResume.js";
import { ValidationError } from "../errors.js";

function json(statusCode: number, body: unknown): APIGatewayProxyResult {
  return { statusCode, body: JSON.stringify(body) };
}

function header(event: APIGatewayProxyEvent, name: string): string {
  const headers = event.headers ?? {};
  const match = Object.entries(headers).find(
    ([key]) => key.toLowerCase() === name.toLowerCase(),
  );
  return match?.[1] ?? "";
}

export const handler = async (
  event: APIGatewayProxyEvent,
): Promise<APIGatewayProxyResult> => {
  try {
    const userId = event.requestContext.authorizer?.claims?.sub;
    if (typeof userId !== "string" || userId.trim().length === 0) {
      throw new ValidationError("userId is required");
    }

    const contentType = header(event, "content-type").split(";")[0].trim();
    if (contentType !== "application/pdf") {
      throw new ValidationError("File must be a PDF");
    }

    if (!event.body) {
      throw new ValidationError("resume file is required");
    }

    const fileBuffer = Buffer.from(
      event.body,
      event.isBase64Encoded ? "base64" : "utf8",
    );

    const stored = await parseResumeCore(userId, fileBuffer);
    const { resumeId, sections, skills, status } = stored;
    return json(200, { resumeId, sections, skills, status });
  } catch (error) {
    if (error instanceof ValidationError) {
      return json(400, { error: error.message });
    }
    if (error instanceof PdfParseError) {
      return json(400, { error: error.message });
    }
    return json(500, { error: "Failed to parse PDF" });
  }
};
