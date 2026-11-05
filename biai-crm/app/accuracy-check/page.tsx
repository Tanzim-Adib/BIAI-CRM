"use client";

import { useState } from "react";

export default function AccuracyCheckPage() {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<any | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    setLoading(true);
    setError(null);
    setData(null);
    try {
      const res = await fetch("/api/accuracy-check");
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? "Failed to run accuracy check.");
        return;
      }
      setData(json);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ minHeight: "100vh", padding: 28 }}>
      <main className="shell" style={{ maxWidth: 1100, margin: "0 auto" }}>
        <div className="head-row">
          <div>
            <h1 className="title">Accuracy check</h1>
            <p className="subtitle">
              Runs all 20 real sample enquiries through the live Gemini extraction and scores it
              against a manually-written answer key. (AF-2)
            </p>
          </div>
          <button className="btn btn-primary" onClick={run} disabled={loading}>
            {loading ? "Running 20 enquiries through Gemini…" : "Run accuracy check"}
          </button>
        </div>

        {error && <p className="error card panel">{error}</p>}

        {data && (
          <>
            <div className="stat-row">
              <div className="card stat">
                <div className="label">Category match</div>
                <div className="value">{data.summary.categoryAccuracy}</div>
              </div>
              <div className="card stat">
                <div className="label">Lead verdict match</div>
                <div className="value">{data.summary.verdictAccuracy}</div>
              </div>
              <div className="card stat">
                <div className="label">Priority match</div>
                <div className="value">{data.summary.priorityAccuracy}</div>
              </div>
            </div>

            <div className="card panel">
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead>
                  <tr style={{ textAlign: "left", borderBottom: "1px solid var(--line)" }}>
                    <th style={{ padding: 8 }}>#</th>
                    <th style={{ padding: 8 }}>Sender</th>
                    <th style={{ padding: 8 }}>Expected</th>
                    <th style={{ padding: 8 }}>AI extracted</th>
                    <th style={{ padding: 8 }}>Match</th>
                  </tr>
                </thead>
                <tbody>
                  {data.results.map((r: any) => (
                    <tr key={r.id} style={{ borderBottom: "1px solid var(--line)" }}>
                      <td style={{ padding: 8 }}>{r.id}</td>
                      <td style={{ padding: 8 }}>{r.senderName}</td>
                      {r.error ? (
                        <td colSpan={3} style={{ padding: 8, color: "var(--high)" }}>
                          {r.error}
                        </td>
                      ) : (
                        <>
                          <td style={{ padding: 8 }}>
                            {r.expected.category} / {r.expected.leadVerdict} / {r.expected.priority}
                          </td>
                          <td style={{ padding: 8 }}>
                            {r.extracted.category} / {r.extracted.lead_verdict} / {r.extracted.priority}
                          </td>
                          <td style={{ padding: 8 }}>
                            {r.scoring.categoryMatch ? "✅" : "❌"} {r.scoring.verdictMatch ? "✅" : "❌"}{" "}
                            {r.scoring.priorityMatch ? "✅" : "❌"}
                          </td>
                        </>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
