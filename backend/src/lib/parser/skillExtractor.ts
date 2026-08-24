import { normalizeToken } from "jdfit-shared";

function splitSkillTokens(text: string): string[] {
  const tokens: string[] = [];
  for (const rawLine of text.split(/\r?\n/)) {
    let line = rawLine.trim();
    if (!line) {
      continue;
    }
    const colon = line.indexOf(":");
    if (colon !== -1) {
      line = line.slice(colon + 1);
    }
    line = line.replace(/\([^)]*\)/g, "");
    for (const part of line.split(/[,|•·*/]+/)) {
      const token = part.replace(/^\s*[-–—]\s*/, "").trim();
      if (token.length > 0) {
        tokens.push(token);
      }
    }
  }
  return tokens;
}

function stripEdges(token: string): string {
  return token.replace(/^[^\w#.]+/, "").replace(/[^\w#+]+$/, "");
}

function experienceTokens(text: string): string[] {
  const unigrams = text
    .split(/\s+/)
    .map(stripEdges)
    .filter((token) => token.length > 0);
  const tokens = [...unigrams];
  for (let i = 0; i < unigrams.length - 1; i++) {
    tokens.push(`${unigrams[i]} ${unigrams[i + 1]}`);
  }
  return tokens;
}

function addUnique(target: string[], seen: Set<string>, token: string): void {
  const key = token.toLowerCase();
  if (seen.has(key)) {
    return;
  }
  seen.add(key);
  target.push(token);
}

export function extractSkills(sections: Record<string, string>): string[] {
  const seen = new Set<string>();
  const skills: string[] = [];

  for (const token of splitSkillTokens(sections.skills ?? "")) {
    addUnique(skills, seen, token);
  }

  for (const body of [sections.experience ?? "", sections.projects ?? ""]) {
    for (const token of experienceTokens(body)) {
      if (normalizeToken(token)) {
        addUnique(skills, seen, token);
      }
    }
  }

  return skills;
}
