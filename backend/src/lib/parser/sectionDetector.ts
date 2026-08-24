const MAX_HEADER_WORDS = 8;

function normalizeLine(line: string): string {
  return line.trim().toLowerCase().replace(/:+\s*$/, "").replace(/\s+/g, " ");
}

function headerKey(line: string): string | null {
  const normalized = normalizeLine(line);
  if (!normalized) {
    return null;
  }
  const wordCount = normalized.split(" ").length;
  if (wordCount === 0 || wordCount > MAX_HEADER_WORDS) {
    return null;
  }

  if (/\beducation\b/.test(normalized)) {
    return "education";
  }
  if (
    /\bwork history\b/.test(normalized) ||
    /\bwork experience\b/.test(normalized) ||
    /\bprofessional experience\b/.test(normalized)
  ) {
    return "experience";
  }
  if (/\bexperience\b/.test(normalized)) {
    return "experience";
  }
  if (/\bskills?\b/.test(normalized)) {
    return "skills";
  }
  if (/\bprojects?\b/.test(normalized)) {
    return "projects";
  }
  if (/\bcertifications?\b/.test(normalized)) {
    return "certifications";
  }
  if (/\bsummary\b/.test(normalized)) {
    return "summary";
  }
  if (/\bobjective\b/.test(normalized)) {
    return "objective";
  }
  return null;
}

export function detectSections(rawText: string): Record<string, string> {
  const sections: Record<string, string[]> = {};
  let current: string | null = null;

  for (const line of rawText.split(/\r?\n/)) {
    const key = headerKey(line);
    if (key) {
      current = key;
      if (!(key in sections)) {
        sections[key] = [];
      }
      continue;
    }
    if (current) {
      sections[current].push(line);
    }
  }

  const result: Record<string, string> = {};
  for (const [key, lines] of Object.entries(sections)) {
    result[key] = lines.join("\n").trim();
  }
  return result;
}
