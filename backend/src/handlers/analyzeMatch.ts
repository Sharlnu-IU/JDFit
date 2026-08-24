import { analyzeMatch as scoreMatch, type MatchReport } from "jdfit-shared";
import { resumeStore } from "../store/resumes.js";

const LOCAL_USER_ID = "local-dev-user";

export class ResumeNotFoundError extends Error {
  constructor() {
    super("resume not found");
    this.name = "ResumeNotFoundError";
  }
}

export async function analyzeMatch(input: {
  resumeId: string;
  jdText: string;
}): Promise<MatchReport> {
  const context = { userId: LOCAL_USER_ID };
  void context.userId;

  const resume = resumeStore.get(input.resumeId);
  if (!resume) {
    throw new ResumeNotFoundError();
  }

  return scoreMatch(resume.skills, input.jdText);
}
