import type {
  APIGatewayProxyEvent,
  APIGatewayProxyResult,
} from "aws-lambda";

export const handler = async (
  _event: APIGatewayProxyEvent,
): Promise<APIGatewayProxyResult> => ({
  statusCode: 501,
  body: JSON.stringify({ error: "not implemented" }),
});
