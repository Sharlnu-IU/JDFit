import type { SQSEvent } from "aws-lambda";

export const handler = async (_event: SQSEvent): Promise<void> => {
  throw new Error("not implemented");
};
