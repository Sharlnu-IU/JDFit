import cors from "cors";
import express from "express";
import multer, { MulterError } from "multer";
import { analyzeMatchCore, ResumeNotFoundError } from "./core/analyzeMatch.js";
import { parseResumeCore, PdfParseError } from "./core/parseResume.js";
import { ValidationError } from "./errors.js";
import { resumeStore } from "./store/resumes.js";

const app = express();
const PORT = 3001;
const LOCAL_USER_ID = "local-dev-user";
const MAX_RESUME_BYTES = 5 * 1024 * 1024;

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_RESUME_BYTES },
});

app.use(cors({ origin: "http://localhost:5173" }));
app.use(express.json());

app.post("/api/v1/analyses", async (req, res) => {
  try {
    const resumeId = req.body?.resumeId;
    const jdText = req.body?.jdText;
    if (typeof resumeId !== "string" || resumeId.trim().length === 0) {
      throw new ValidationError("resumeId is required");
    }
    if (typeof jdText !== "string" || jdText.trim().length === 0) {
      throw new ValidationError("jdText is required");
    }

    const result = await analyzeMatchCore(LOCAL_USER_ID, resumeId, jdText);
    res.json(result);
  } catch (error) {
    if (error instanceof ValidationError) {
      res.status(400).json({ error: error.message });
      return;
    }
    if (error instanceof ResumeNotFoundError) {
      res.status(404).json({ error: "resume not found" });
      return;
    }
    res.status(500).json({ error: "Internal server error" });
  }
});

app.get("/api/v1/resumes/:resumeId", (req, res) => {
  const stored = resumeStore.get(LOCAL_USER_ID, req.params.resumeId);
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
  try {
    const file = req.file;
    if (!file) {
      throw new ValidationError("resume file is required");
    }
    if (file.mimetype !== "application/pdf") {
      throw new ValidationError("File must be a PDF");
    }

    const stored = await parseResumeCore(LOCAL_USER_ID, file.buffer);
    const { resumeId, sections, skills, status } = stored;
    res.json({ resumeId, sections, skills, status });
  } catch (error) {
    if (error instanceof ValidationError) {
      res.status(400).json({ error: error.message });
      return;
    }
    if (error instanceof PdfParseError) {
      res.status(400).json({ error: error.message });
      return;
    }
    res.status(500).json({ error: "Failed to parse PDF" });
  }
});

app.listen(PORT, () => {
  console.log(`JDFit backend listening on http://localhost:${PORT}`);
});
