"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useState, useCallback } from "react";
import SpinnerLogo from "./SpinnerLogo";

const ForceGraph2D = dynamic(() => import("react-force-graph-2d"), { ssr: false });

type GraphNode = {
  id: string;
  type?: string;
  name?: string;
  category?: string | null;
  stage?: string | null;
  priority?: string | null;
  verdict?: string | null;
  createdAt?: string | null;
  hidden?: boolean;
  leadId?: number | null;
  personId?: string | null;
};

function priorityOpacity(priority: string | null) {
  if (priority === "High") return 1;
  if (priority === "Medium") return 0.75;
  return 0.45;
}

export default function ContactGraph() {
  const [nodes, setNodes] = useState<GraphNode[] | null>(null);
  const [links, setLinks] = useState<any[]>([]);
  const [selected, setSelected] = useState<GraphNode | null>(null);
  const [showHidden, setShowHidden] = useState(false);
  const [category, setCategory] = useState("all");
  const [stage, setStage] = useState("all");
  const [priority, setPriority] = useState("all");

  const load = useCallback(() => {
    const params = new URLSearchParams();
    if (category !== "all") params.set("category", category);
    if (stage !== "all") params.set("stage", stage);
    if (priority !== "all") params.set("priority", priority);

    fetch(`/api/contacts/graph?${params.toString()}`)
      .then((r) => r.json())
      .then((d) => {
        setNodes(d.nodes ?? []);
        setLinks(d.links ?? []);
      });
  }, [category, priority, stage]);

  useEffect(() => {
    load();
  }, [load]);

  const graphData = useMemo(() => {
    const visible = (nodes ?? []).filter((n) => showHidden || !n.hidden);
    const visibleIds = new Set(visible.map((n) => n.id));
    const visibleLinks = links.filter((l) => visibleIds.has(String(l.source)) && visibleIds.has(String(l.target)));
    return { nodes: visible, links: visibleLinks };
  }, [links, nodes, showHidden]);

  if (!nodes) return <SpinnerLogo label="Loading contact graph…" />;

  return (
    <section className="page">
      <div className="head-row">
        <div>
          <h1 className="title">Contact graph</h1>
          <p className="subtitle">Nodes = enquiries · edges = person-to-enquiry links · opacity = priority</p>
        </div>
        <div className="chip-row" style={{ gap: 8, alignItems: "center" }}>
          <select value={category} onChange={(e) => setCategory(e.target.value)}>
            <option value="all">All categories</option>
            <option value="Sales enquiry">Sales enquiry</option>
            <option value="Complaint">Complaint</option>
            <option value="Support question">Support question</option>
            <option value="Spam">Spam</option>
            <option value="Not a lead">Not a lead</option>
          </select>
          <select value={stage} onChange={(e) => setStage(e.target.value)}>
            <option value="all">All stages</option>
            <option value="new">New</option>
            <option value="contacted">Contacted</option>
            <option value="interested">Interested</option>
            <option value="paid">Paid</option>
            <option value="lost">Lost</option>
          </select>
          <select value={priority} onChange={(e) => setPriority(e.target.value)}>
            <option value="all">All priorities</option>
            <option value="High">High</option>
            <option value="Medium">Medium</option>
            <option value="Low">Low</option>
          </select>
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
          linkDirectionalParticles={2}
          nodeLabel={(n: any) => `${n.name || "Unknown"}${n.category ? " · " + n.category : ""}`}
          nodeCanvasObject={(node: any, ctx: CanvasRenderingContext2D, scale: number) => {
            const r = node.type === "person" ? 11 : 8;
            const opacity = node.hidden ? 0.25 : priorityOpacity(node.priority ?? (node.type === "person" ? "Medium" : null));
            ctx.save();
            ctx.globalAlpha = opacity;
            ctx.beginPath();
            ctx.arc(node.x, node.y, r, 0, 2 * Math.PI);
            ctx.fillStyle = node.type === "person" ? "#4c6ef5" : "#c9842e";
            ctx.fill();
            ctx.restore();
            ctx.globalAlpha = 1;
            ctx.font = `${11 / scale}px sans-serif`;
            ctx.fillStyle = "#3a2410";
            ctx.textAlign = "center";
            ctx.fillText(node.name || "Unknown", node.x, node.y + r + 12 / scale);
          }}
          onNodeClick={(n: any) => setSelected(n)}
          cooldownTicks={60}
        />

        {selected && (
          <div style={{ position: "absolute", top: 14, right: 14, width: 300, background: "#fff", border: "1px solid var(--line)", borderRadius: 12, padding: 14, boxShadow: "0 8px 24px rgba(0,0,0,.14)" }}>
            <div className="row-between" style={{ marginTop: 0 }}>
              <strong style={{ fontSize: 14 }}>{selected.name || "Unknown"}</strong>
              <button className="btn btn-ghost" style={{ fontSize: 10, padding: "3px 7px" }} onClick={() => setSelected(null)}>
                ✕
              </button>
            </div>
            <div style={{ marginTop: 8, fontSize: 12 }}>
              <div><strong>Type:</strong> {selected.type === "person" ? "Person" : "Enquiry"}</div>
              {selected.category && <div><strong>Category:</strong> {selected.category}</div>}
              {selected.stage && <div><strong>Stage:</strong> {selected.stage}</div>}
              {selected.priority && <div><strong>Priority:</strong> {selected.priority}</div>}
              {selected.verdict && <div><strong>Verdict:</strong> {selected.verdict}</div>}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
