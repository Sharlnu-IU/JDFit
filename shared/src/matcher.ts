import { normalizeToken } from "./normalization.js";
import type { MatchReport } from "./types.js";

function stripEdges(token: string): string {
  return token
    .replace(/^[^\w#.]+/, "")
    .replace(/[^\w#+]+$/, "");
}

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[\s/]+/)
    .map(stripEdges)
    .filter((token) => token.length > 0);
}

function skillCandidates(text: string): string[] {
  const unigrams = tokenize(text);
  const bigrams: string[] = [];
  for (let i = 0; i < unigrams.length - 1; i++) {
    bigrams.push(`${unigrams[i]} ${unigrams[i + 1]}`);
  }
  return [...unigrams, ...bigrams];
}

function uniqueNormalized(tokens: string[]): Set<string> {
  const skills = new Set<string>();
  for (const token of tokens) {
    const canonical = normalizeToken(token);
    if (canonical) {
      skills.add(canonical);
    }
  }
  return skills;
}

export function analyzeMatch(resumeSkills: string[], jdText: string): MatchReport {
  const jdSkills = uniqueNormalized(skillCandidates(jdText));
  const resume = uniqueNormalized(resumeSkills);

  const matched: string[] = [];
  const missing: string[] = [];

  for (const skill of jdSkills) {
    if (resume.has(skill)) {
      matched.push(skill);
    } else {
      missing.push(skill);
    }
  }

  matched.sort();
  missing.sort();

  const score =
    jdSkills.size === 0 ? 0 : Math.round((matched.length / jdSkills.size) * 100);

  return {
    score,
    matched,
    missing,
    weak: [],
  };
}
