import { analyzeMatch as scoreMatch, type MatchReport } from "jdfit-shared";

const LOCAL_USER_ID = "local-dev-user";

const HARDCODED_RESUME_SKILLS = [
  "java",
  "python",
  "javascript",
  "typescript",
  "spring boot",
  "angular",
  "flask",
  "docker",
  "kubernetes",
  "postgresql",
  "rabbitmq",
  "git",
  "junit",
  "pyspark",
  "gcp",
  "golang",
];

export async function analyzeMatch(input: { jdText: string }): Promise<MatchReport> {
  const context = { userId: LOCAL_USER_ID };
  void context.userId;
  return scoreMatch(HARDCODED_RESUME_SKILLS, input.jdText);
}
