import { useState, type ChangeEvent } from "react";

type UploadResponse = {
  resumeId: string;
  sections: Record<string, string>;
  skills: string[];
  status: string;
};

function isUploadResponse(data: unknown): data is UploadResponse {
  if (data === null || typeof data !== "object") {
    return false;
  }
  if (!("resumeId" in data) || typeof data.resumeId !== "string") {
    return false;
  }
  if (!("skills" in data) || !Array.isArray(data.skills)) {
    return false;
  }
  if (!("sections" in data) || typeof data.sections !== "object" || data.sections === null) {
    return false;
  }
  return true;
}

function App() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [resumeId, setResumeId] = useState<string | null>(null);
  const [skills, setSkills] = useState<string[]>([]);
  const [sectionNames, setSectionNames] = useState<string[]>([]);
  const [uploadError, setUploadError] = useState("");
  const [uploading, setUploading] = useState(false);

  const [jdText, setJdText] = useState("");
  const [result, setResult] = useState("");
  const [analyzing, setAnalyzing] = useState(false);

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    setSelectedFile(event.target.files?.[0] ?? null);
  }

  async function handleUpload() {
    if (!selectedFile) {
      return;
    }

    setUploading(true);
    setUploadError("");
    try {
      const body = new FormData();
      body.append("resume", selectedFile);
      const response = await fetch("http://localhost:3001/api/v1/resumes", {
        method: "POST",
        body,
      });
      const data: unknown = await response.json();
      if (!response.ok || !isUploadResponse(data)) {
        const message =
          data !== null &&
          typeof data === "object" &&
          "error" in data &&
          typeof data.error === "string"
            ? data.error
            : "Upload failed";
        setUploadError(message);
        setResumeId(null);
        setSkills([]);
        setSectionNames([]);
        return;
      }

      setResumeId(data.resumeId);
      setSkills(data.skills.map(String));
      setSectionNames(Object.keys(data.sections));
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : "Upload failed");
      setResumeId(null);
      setSkills([]);
      setSectionNames([]);
    } finally {
      setUploading(false);
    }
  }

  async function handleAnalyze() {
    if (!resumeId) {
      return;
    }

    setAnalyzing(true);
    try {
      const response = await fetch("http://localhost:3001/api/v1/analyses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resumeId, jdText }),
      });
      const data: unknown = await response.json();
      setResult(JSON.stringify(data, null, 2));
    } catch (error) {
      const message = error instanceof Error ? error.message : "Request failed";
      setResult(message);
    } finally {
      setAnalyzing(false);
    }
  }

  return (
    <main className="mx-auto max-w-2xl p-6">
      <section>
        <h2 className="font-medium">Upload résumé</h2>
        <label htmlFor="resume" className="mt-2 block">
          PDF file
        </label>
        <input
          id="resume"
          type="file"
          accept="application/pdf"
          onChange={handleFileChange}
          disabled={uploading}
          className="mt-2 block"
        />
        <button
          type="button"
          onClick={handleUpload}
          disabled={uploading || !selectedFile}
          className="mt-3 border px-3 py-1"
        >
          {uploading ? "Uploading..." : "Upload"}
        </button>
        {uploadError ? <p className="mt-3">{uploadError}</p> : null}
        {resumeId ? (
          <div className="mt-3">
            <p>resumeId: {resumeId}</p>
            <p>Sections: {sectionNames.join(", ") || "(none)"}</p>
            <p>Skills: {skills.join(", ") || "(none)"}</p>
          </div>
        ) : null}
      </section>

      {resumeId ? (
        <section className="mt-8">
          <h2 className="font-medium">Analyze job description</h2>
          <label htmlFor="jd" className="mt-2 block">
            Paste Job Description
          </label>
          <textarea
            id="jd"
            value={jdText}
            onChange={(event) => setJdText(event.target.value)}
            rows={12}
            className="mt-2 block w-full border p-2"
          />
          <button
            type="button"
            onClick={handleAnalyze}
            disabled={analyzing || !jdText.trim()}
            className="mt-3 border px-3 py-1"
          >
            {analyzing ? "Analyzing..." : "Analyze"}
          </button>
          <pre className="mt-4 whitespace-pre-wrap">{result}</pre>
        </section>
      ) : null}
    </main>
  );
}

export default App;
