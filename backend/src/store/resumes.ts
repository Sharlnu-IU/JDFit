export type StoredResume = {
  resumeId: string;
  rawText: string;
  sections: Record<string, string>;
  skills: string[];
  status: "READY";
};

export const resumeStore = new Map<string, StoredResume>();
