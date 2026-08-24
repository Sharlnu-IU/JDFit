import cors from "cors";
import express from "express";
import multer, { MulterError } from "multer";
import { analyzeMatch, ResumeNotFoundError } from "./handlers/analyzeMatch.js";
import { uploadResume } from "./handlers/uploadResume.js";
import { resumeStore } from "./store/resumes.js";

const app = express();
const PORT = 3001;
const MAX_RESUME_BYTES = 5 * 1024 * 1024;

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_RESUME_BYTES },
});

app.use(cors({ origin: "http://localhost:5173" }));
app.use(express.json());

app.post("/api/v1/analyses", async (req, res) => {
  const resumeId = req.body?.resumeId;
  const jdText = req.body?.jdText;
  if (typeof resumeId !== "string" || resumeId.trim().length === 0) {
    res.status(400).json({ error: "resumeId is required" });
    return;
  }
  if (typeof jdText !== "string" || jdText.trim().length === 0) {
    res.status(400).json({ error: "jdText is required" });
    return;
  }

  try {
    const result = await analyzeMatch({ resumeId, jdText });
    res.json(result);
  } catch (error) {
    if (error instanceof ResumeNotFoundError) {
      res.status(404).json({ error: "resume not found" });
      return;
    }
    throw error;
  }
});

app.get("/api/v1/resumes/:resumeId", (req, res) => {
  const stored = resumeStore.get(req.params.resumeId);
  if (!stored) {
    res.status(404).json({ error: "resume not found" });
    return;
  }
  res.json(stored);
});

app.post("/api/v1/resumes", (req, res, next) => {
  upload.single("resume")(req, res, (err: unknown) => {
    if (err instanceof MulterError && err.code === "LIMIT_FILE_SIZE") {
      res.status(400).json({ error: "File must be under 5MB" });
      return;
    }
    if (err) {
      next(err);
      return;
    }
    next();
  });
}, async (req, res) => {
  const file = req.file;
  if (!file) {
    res.status(400).json({ error: "resume file is required" });
    return;
  }
  if (file.mimetype !== "application/pdf") {
    res.status(400).json({ error: "File must be a PDF" });
    return;
  }

  try {
    const stored = await uploadResume(file.buffer);
    const { resumeId, sections, skills, status } = stored;
    res.json({ resumeId, sections, skills, status });
  } catch {
    res.status(500).json({ error: "Failed to parse PDF" });
  }
});

app.listen(PORT, () => {
  console.log(`JDFit backend listening on http://localhost:${PORT}`);
});
