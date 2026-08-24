export type StoredResume = {
  userId: string;
  resumeId: string;
  rawText: string;
  sections: Record<string, string>;
  skills: string[];
  status: "READY";
};

const store = new Map<string, StoredResume>();

function key(userId: string, resumeId: string): string {
  return `${userId}:${resumeId}`;
}

export const resumeStore = {
  set(userId: string, resume: StoredResume): void {
    store.set(key(userId, resume.resumeId), resume);
  },
  get(userId: string, resumeId: string): StoredResume | undefined {
    return store.get(key(userId, resumeId));
  },
};
