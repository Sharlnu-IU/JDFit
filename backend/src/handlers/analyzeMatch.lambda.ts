import type {
  APIGatewayProxyEvent,
  APIGatewayProxyResult,
} from "aws-lambda";
import { analyzeMatchCore, ResumeNotFoundError } from "../core/analyzeMatch.js";
import { ValidationError } from "../errors.js";

function json(statusCode: number, body: unknown): APIGatewayProxyResult {
  return { statusCode, body: JSON.stringify(body) };
}

export const handler = async (
  event: APIGatewayProxyEvent,
): Promise<APIGatewayProxyResult> => {
  try {
    const userId = event.requestContext.authorizer?.claims?.sub;
    if (typeof userId !== "string" || userId.trim().length === 0) {
      throw new ValidationError("userId is required");
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(event.body ?? "");
    } catch {
      throw new ValidationError("request body must be JSON");
    }

    const resumeId =
      parsed !== null && typeof parsed === "object" && "resumeId" in parsed
        ? parsed.resumeId
        : undefined;
    const jdText =
      parsed !== null && typeof parsed === "object" && "jdText" in parsed
        ? parsed.jdText
        : undefined;

    if (typeof resumeId !== "string" || resumeId.trim().length === 0) {
      throw new ValidationError("resumeId is required");
    }
    if (typeof jdText !== "string" || jdText.trim().length === 0) {
      throw new ValidationError("jdText is required");
    }

    const result = await analyzeMatchCore(userId, resumeId, jdText);
    return json(200, result);
  } catch (error) {
    if (error instanceof ValidationError) {
      return json(400, { error: error.message });
    }
    if (error instanceof ResumeNotFoundError) {
      return json(404, { error: "resume not found" });
    }
    return json(500, { error: "Internal server error" });
  }
};
