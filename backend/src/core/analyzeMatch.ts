import { analyzeMatch as scoreMatch, type MatchReport } from "jdfit-shared";
import { resumeStore } from "../store/resumes.js";

export class ResumeNotFoundError extends Error {
  constructor() {
    super("resume not found");
    this.name = "ResumeNotFoundError";
  }
}

export async function analyzeMatchCore(
  userId: string,
  resumeId: string,
  jdText: string,
): Promise<MatchReport> {
  const resume = resumeStore.get(userId, resumeId);
  if (!resume) {
    throw new ResumeNotFoundError();
  }

  return scoreMatch(resume.skills, jdText);
}
