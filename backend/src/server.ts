import cors from "cors";
import express from "express";
import { analyzeMatch } from "./handlers/analyzeMatch.js";

const app = express();
const PORT = 3001;

app.use(cors({ origin: "http://localhost:5173" }));
app.use(express.json());

app.post("/api/v1/analyses", async (req, res) => {
  const jdText = req.body?.jdText;
  if (typeof jdText !== "string" || jdText.trim().length === 0) {
    res.status(400).json({ error: "jdText is required" });
    return;
  }

  const result = await analyzeMatch({ jdText });
  res.json(result);
});

app.listen(PORT, () => {
  console.log(`JDFit backend listening on http://localhost:${PORT}`);
});
