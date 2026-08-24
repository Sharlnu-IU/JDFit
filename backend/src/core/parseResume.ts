import { randomUUID } from "node:crypto";
import { PDFParse } from "pdf-parse";
import { detectSections } from "../lib/parser/sectionDetector.js";
import { extractSkills } from "../lib/parser/skillExtractor.js";
import { resumeStore, type StoredResume } from "../store/resumes.js";

export class PdfParseError extends Error {
  constructor() {
    super("Failed to parse PDF");
    this.name = "PdfParseError";
  }
}

async function extractText(buffer: Buffer): Promise<string> {
  const parser = new PDFParse({ data: new Uint8Array(buffer) });
  try {
    const result = await parser.getText();
    return result.text;
  } finally {
    await parser.destroy();
  }
}

export async function parseResumeCore(
  userId: string,
  fileBuffer: Buffer,
): Promise<StoredResume> {
  let rawText: string;
  try {
    rawText = await extractText(fileBuffer);
  } catch {
    throw new PdfParseError();
  }
  const sections = detectSections(rawText);
  const skills = extractSkills(sections);
  const resumeId = randomUUID();
  const stored: StoredResume = {
    userId,
    resumeId,
    rawText,
    sections,
    skills,
    status: "READY",
  };
  resumeStore.set(userId, stored);
  return stored;
}
