import { randomUUID } from "node:crypto";
import { PDFParse } from "pdf-parse";
import { detectSections } from "../lib/parser/sectionDetector.js";
import { extractSkills } from "../lib/parser/skillExtractor.js";
import { resumeStore, type StoredResume } from "../store/resumes.js";

async function extractText(buffer: Buffer): Promise<string> {
  const parser = new PDFParse({ data: new Uint8Array(buffer) });
  try {
    const result = await parser.getText();
    return result.text;
  } finally {
    await parser.destroy();
  }
}

export async function uploadResume(buffer: Buffer): Promise<StoredResume> {
  const rawText = await extractText(buffer);
  const sections = detectSections(rawText);
  const skills = extractSkills(sections);
  const resumeId = randomUUID();
  const stored: StoredResume = {
    resumeId,
    rawText,
    sections,
    skills,
    status: "READY",
  };
  resumeStore.set(resumeId, stored);
  return stored;
}
