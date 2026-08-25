import type { S3Event } from "aws-lambda";

export const handler = async (_event: S3Event): Promise<void> => {
  throw new Error("not implemented");
};
