"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useState, useCallback } from "react";
import SpinnerLogo from "./SpinnerLogo";

// react-force-graph-2d touches `window`/canvas directly, so it can only
// render client-side — ssr:false is required, not optional, here.
const ForceGraph2D = dynamic(() => import("react-force-graph-2d"), { ssr: false });

type Node = {
  id: number;
  name: string;
  org: string | null;
  channel: string | null;
  aiSummary: string | null;
  hidden: boolean;
  leadId: number | null;
  category: string | null;
  priority: "High" | "Medium" | "Low" | null;
  stage: string | null;
  leadVerdict: string | null;
  leadReasoning: string | null;
  estimatedValue: string | null;
  escalated: boolean;
  resolved: boolean;
  takenByName: string | null;
  needsAction: boolean;
};

function priorityOpacity(priority: string | null) {
  // "More important = less transparent" per AF-11.
  if (priority === "High") return 1;
  if (priority === "Medium") return 0.75;
  return 0.45;
}

export default function ContactGraph() {
  const [nodes, setNodes] = useState<Node[] | null>(null);
  const [selected, setSelected] = useState<Node | null>(null);
  const [showHidden, setShowHidden] = useState(false);

  const load = useCallback(() => {
    fetch("/api/contacts/graph")
      .then((r) => r.json())
      .then((d) => setNodes(d.nodes ?? []));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const graphData = useMemo(() => {
    const visible = (nodes ?? []).filter((n) => showHidden || !n.hidden);
    return {
      nodes: visible.map((n) => ({ ...n })),
      links: [], // no inter-contact relationships in this data model — nodes only
    };
  }, [nodes, showHidden]);

  async function hideNode(n: Node, hide: boolean) {
    const res = await fetch(`/api/contacts/${n.id}/hide`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ hide }),
    });
    const data = await res.json();
    if (!res.ok) {
      alert(data.error ?? "Couldn't update.");
      return;
    }
    setSelected(null);
    load();
  }

  if (!nodes) return <SpinnerLogo label="Loading contact graph…" />;

  return (
    <section className="page">
      <div className="head-row">
        <div>
          <h1 className="title">Contact graph</h1>
          <p className="subtitle">
            Opacity = priority · a red ring = needs immediate action · click a node for details
          </p>
        </div>
        <div className="chip-row">
          <label style={{ fontSize: 12.5, display: "flex", gap: 6, alignItems: "center", cursor: "pointer" }}>
            <input type="checkbox" checked={showHidden} onChange={(e) => setShowHidden(e.target.checked)} />
            Show hidden
          </label>
        </div>
      </div>

      <div style={{ position: "relative", height: 560, border: "1px solid var(--line)", borderRadius: 14, overflow: "hidden", background: "#fffaf4" }}>
        <ForceGraph2D
          graphData={graphData}
          nodeId="id"
          nodeLabel={(n: any) => `${n.name}${n.org ? " · " + n.org : ""}`}
          nodeCanvasObject={(node: any, ctx: CanvasRenderingContext2D, scale: number) => {
            const r = 9;
            const opacity = node.hidden ? 0.25 : priorityOpacity(node.priority);
            ctx.save();
            ctx.globalAlpha = opacity;
            ctx.beginPath();
            ctx.arc(node.x, node.y, r, 0, 2 * Math.PI);
            ctx.fillStyle = "#c9842e";
            ctx.fill();
            if (node.needsAction) {
              ctx.globalAlpha = 1;
              ctx.lineWidth = 2.5;
              ctx.strokeStyle = "#d8453b";
              ctx.stroke();
            }
            ctx.restore();
            ctx.globalAlpha = 1;
            ctx.font = `${11 / scale}px sans-serif`;
            ctx.fillStyle = "#3a2410";
            ctx.textAlign = "center";
            ctx.fillText(node.name, node.x, node.y + r + 11 / scale);
          }}
          onNodeClick={(n: any) => setSelected(n)}
          cooldownTicks={60}
        />

        {selected && (
          <div
            style={{
              position: "absolute",
              top: 14,
              right: 14,
              width: 300,
              background: "#fff",
              border: "1px solid var(--line)",
              borderRadius: 12,
              padding: 14,
              boxShadow: "0 8px 24px rgba(0,0,0,.14)",
            }}
          >
            <div className="row-between" style={{ marginTop: 0 }}>
              <strong style={{ fontSize: 14 }}>{selected.name}</strong>
              <button className="btn btn-ghost" style={{ fontSize: 10, padding: "3px 7px" }} onClick={() => setSelected(null)}>
                ✕
              </button>
            </div>
            {selected.org && <div style={{ fontSize: 12, color: "var(--ink-soft)" }}>{selected.org}</div>}

            <div style={{ marginTop: 8, fontSize: 12 }}>
              <div><strong>Status:</strong> {selected.stage ?? "—"}</div>
              <div><strong>Lead verdict:</strong> {selected.leadVerdict ?? "—"}</div>
              <div><strong>Category:</strong> {selected.category ?? "—"}</div>
              {selected.escalated && !selected.resolved && (
                <div style={{ color: "var(--high)", fontWeight: 700 }}>🚩 Needs immediate action</div>
              )}
              {selected.takenByName && <div>Claimed by: {selected.takenByName}</div>}
            </div>

            {selected.aiSummary && (
              <div className="verdict-box" style={{ marginTop: 8, fontSize: 12 }}>
                {selected.aiSummary}
              </div>
            )}

            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 10 }}>
              <button
                className="btn btn-dark"
                style={{ fontSize: 11, padding: "6px 10px" }}
                onClick={() => {
                  window.dispatchEvent(new CustomEvent("biai:jump-to-pipeline"));
                }}
              >
                Jump to chat
              </button>
              {!selected.hidden ? (
                <button
                  className="btn btn-ghost"
                  style={{ fontSize: 11, padding: "6px 10px" }}
                  onClick={() => hideNode(selected, true)}
                  title="Low-priority, resolved contacts only"
                >
                  Hide from graph
                </button>
              ) : (
                <button
                  className="btn btn-ghost"
                  style={{ fontSize: 11, padding: "6px 10px" }}
                  onClick={() => hideNode(selected, false)}
                >
                  Unhide
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
