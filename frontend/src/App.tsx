import { useState } from "react";

function App() {
  const [jdText, setJdText] = useState("");
  const [result, setResult] = useState("");
  const [loading, setLoading] = useState(false);


  async function handleAnalyze() {
    setLoading(true);
    try {
      const response = await fetch("http://localhost:3001/api/v1/analyses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jdText }),
      });
      const data: unknown = await response.json();
      setResult(JSON.stringify(data, null, 2));
    } catch (error) {
      const message = error instanceof Error ? error.message : "Request failed";
      setResult(message);
    } finally {
      setLoading(false);
    } 
  }

  return (
    <main className="mx-auto max-w-2xl p-6">
      <label htmlFor="jd" className="block font-medium">
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
        disabled={loading || !jdText.trim()}
        className="mt-3 border px-3 py-1"
      >
        {loading ? "Analyzing..." : "Analyze"}
      </button>
      <pre className="mt-4 whitespace-pre-wrap">{result}</pre>
    </main>
  );
}

export default App;
