"use client";

import { useState } from "react";

// Small reusable "copy this text" button — used for the AI-suggested reply
// so staff can copy it straight into WhatsApp/Messenger/email without
// selecting text by hand.
export default function CopyButton({ text, label = "Copy" }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy(e: React.MouseEvent) {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // clipboard API blocked (rare, e.g. insecure context) — fail quietly
    }
  }

  return (
    <button
      type="button"
      className="btn btn-ghost"
      style={{ fontSize: 11, padding: "4px 9px" }}
      onClick={handleCopy}
    >
      {copied ? "Copied ✓" : label}
    </button>
  );
}
