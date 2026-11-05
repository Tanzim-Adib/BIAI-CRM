"use client";

import { useEffect, useRef, useState } from "react";

// Same real 3D coin as the intro loader (CoinLoader.tsx) — identical rim
// layers, face markup and CSS classes, just smaller and reused as a live
// widget: it spins continuously in idle (never stops, unlike the intro's
// one-shot sequence) and does an intro-style toss on click, landing on
// whichever face carries the rep's stats. Recognition widget, not a ledger
// — deliberately no money shown (commission varies by deal size/tier, so a
// guessed taka figure here would be a liability if it turned out wrong).
const EDGE_LAYERS = 22;
const SIZE = 133; // ~15% smaller than the previous 156px widget size
const TOSS_SECONDS = 1.1;

const random = (min: number, max: number) => min + Math.random() * (max - min);
const easeInCubic = (t: number) => t * t * t;
const easeOutQuad = (t: number) => 1 - (1 - t) * (1 - t);

type Pose = { x: number; y: number; z: number; rotateX: number; rotateY: number; rotateZ: number };

function applyCoinPose(el: HTMLElement, p: Pose) {
  const rx = (p.rotateX * Math.PI) / 180;
  const ry = (p.rotateY * Math.PI) / 180;
  const facing = Math.abs(Math.cos(rx) * Math.cos(ry));
  el.style.transform = `translate3d(${p.x}px, ${p.y}px, ${p.z}px) rotateZ(${p.rotateZ}deg) rotateX(${p.rotateX}deg) rotateY(${p.rotateY}deg)`;
  el.style.setProperty("--shade", String((1 - facing) * 0.5));
  el.style.setProperty("--shine", `${50 + Math.sin(ry + rx) * 90}%`);
  return facing;
}

export default function CoinRewardWidget() {
  const [stats, setStats] = useState<{ paidCount: number; totalTaken: number } | null>(null);
  const coinRef = useRef<HTMLDivElement>(null);

  function loadStats() {
    fetch("/api/rep-stats")
      .then((r) => r.json())
      .then((d) => {
        if (d.paidCount !== undefined) setStats(d);
      })
      .catch(() => {});
  }

  useEffect(() => {
    loadStats();
  }, []);

  useEffect(() => {
    const coin = coinRef.current!;

    for (let i = 0; i < EDGE_LAYERS; i++) {
      const depth = i / (EDGE_LAYERS - 1) - 0.5;
      const curve = 1 - Math.abs(depth) * 2;
      const edge = document.createElement("div");
      edge.className = "coin-edge";
      edge.style.transform = `translateZ(calc(var(--coin-thickness) * ${depth}))`;
      edge.style.filter = `brightness(${0.78 + curve * 0.22})`;
      coin.insertBefore(edge, coin.firstChild);
    }

    const pose: Pose = { x: 0, y: 0, z: 0, rotateX: 8, rotateY: 0, rotateZ: 0 };
    let phase: "idle" | "tossing" = "idle";
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let velocity = random(60, 120);
    let targetVelocity = velocity;
    let nextChange = 0;
    const wobblePhase = [random(0, 6.28), random(0, 6.28), random(0, 6.28)];
    let elapsed = 0;
    let last = performance.now();
    let toss: {
      startedAt: number;
      from: Pose;
      peak: number;
      depth: number;
      flipSpeed: number;
      landRotateY: number;
    } | null = null;
    let raf = 0;
    let cancelled = false;
    let flipped = false;

    coin.style.opacity = "1";

    function onClick() {
      if (phase === "tossing" || cancelled) return;
      loadStats();
      phase = "tossing";
    }
    coin.addEventListener("click", onClick);

    function render(now: number) {
      if (cancelled) return;
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;
      elapsed += dt;

      if (phase === "idle") {
        if (elapsed > nextChange) {
          targetVelocity = Math.random() < 0.25 ? random(180, 260) : random(40, 140);
          nextChange = elapsed + random(1.5, 4);
        }
        velocity += (targetVelocity - velocity) * Math.min(1, dt * 1.2);
        const speed = reduceMotion ? 40 : velocity;
        pose.rotateY = (pose.rotateY + speed * dt) % 360;
        pose.rotateX = 8 + Math.sin(elapsed * 1.1 + wobblePhase[0]) * 5 + Math.sin(elapsed * 0.4 + wobblePhase[1]) * 3;
        pose.rotateZ = Math.sin(elapsed * 0.8 + wobblePhase[2]) * 4;
        pose.y = Math.sin(elapsed * 1.6) * 2;
        pose.x = 0;
        pose.z = 0;
        applyCoinPose(coin, pose);
      } else if (phase === "tossing") {
        if (!toss) {
          const nextFlipped = !flipped;
          // Land on an exact multiple of 360 (front) or 180 off (back) from
          // wherever the coin currently is, so the right face ends facing up.
          const currentMod = ((pose.rotateY % 360) + 360) % 360;
          const spins = 3; // extra full spins during the toss, for flourish
          const targetMod = nextFlipped ? 180 : 0;
          let delta = targetMod - currentMod;
          if (delta <= 0) delta += 360;
          toss = {
            startedAt: now,
            from: { ...pose },
            peak: SIZE * 0.55,
            depth: SIZE * 1.4,
            flipSpeed: delta + 360 * spins,
            landRotateY: pose.rotateY + delta + 360 * spins,
          };
          flipped = nextFlipped;
        }
        const t = Math.min((now - toss.startedAt) / 1000 / TOSS_SECONDS, 1);
        pose.y = toss.from.y - toss.peak * Math.sin(Math.PI * t);
        pose.z = -toss.depth * Math.sin(Math.PI * t) * 0.4;
        pose.rotateY = toss.from.rotateY + toss.flipSpeed * easeOutQuad(t);
        pose.rotateX = toss.from.rotateX * (1 - t) + 8 * t;
        pose.rotateZ = toss.from.rotateZ * (1 - t);
        applyCoinPose(coin, pose);
        if (t >= 1) {
          pose.rotateY = toss.landRotateY;
          toss = null;
          phase = "idle";
          nextChange = elapsed + random(1, 2.5);
        }
      }
      raf = requestAnimationFrame(render);
    }
    raf = requestAnimationFrame(render);

    return () => {
      cancelled = true;
      coin.removeEventListener("click", onClick);
      cancelAnimationFrame(raf);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      className="reward-coin-wrap"
      style={{
        position: "fixed",
        right: 24,
        bottom: 104, // raised well above the corner so it clears page chrome
        zIndex: 60,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 8,
        ["--coin-size" as any]: `${SIZE}px`,
      }}
    >
      <div className="coin-stage" title="Click for your lead stats">
        <div className="coin" ref={coinRef}>
          <div className="coin-face coin-face-front">
            <div className="coin-face-surface">
              <svg
                className="coin-emblem"
                viewBox="-100 -100 200 200"
                style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}
              >
                <defs>
                  <clipPath id="rewardEmblemClip">
                    <circle r="100" />
                  </clipPath>
                </defs>
                <g clipPath="url(#rewardEmblemClip)">
                  <g transform="rotate(45)">
                    {[0, 90, 180, 270].map((angle) => (
                      <g key={angle} transform={`rotate(${angle})`}>
                        <rect x="-110" y="-36" width="127" height="11" />
                        <rect x="-110" y="-110" width="63.5" height="66" />
                        <rect x="-39.5" y="-110" width="25" height="66" />
                        <rect x="-7.5" y="-110" width="25.5" height="66" />
                      </g>
                    ))}
                    <circle r="18" />
                  </g>
                </g>
              </svg>
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  borderRadius: 9999,
                  boxShadow: "inset 0 0 0 2px rgba(255,255,255,.18), inset 0 -8px 18px rgba(60,20,0,.25)",
                }}
              />
              <div className="coin-shine" />
              <div className="coin-shade" />
            </div>
          </div>
          <div className="coin-face coin-face-back">
            <div className="coin-face-surface">
              <div className="coin-face-ring" />
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "var(--coin-brand)",
                }}
              >
                <span style={{ fontSize: Math.round(SIZE * 0.26), fontWeight: 800, lineHeight: 1 }}>
                  {stats?.totalTaken ?? "–"}
                </span>
                <span style={{ fontSize: Math.round(SIZE * 0.09), fontWeight: 700, letterSpacing: 1 }}>LEADS</span>
              </div>
              <div className="coin-shine" />
              <div className="coin-shade" />
            </div>
          </div>
        </div>
      </div>

      <span
        style={{
          fontSize: 12,
          fontWeight: 700,
          color: "var(--ink-soft)",
          background: "#fff",
          padding: "4px 10px",
          borderRadius: 999,
          border: "1px solid var(--line)",
        }}
      >
        🏆 {stats?.paidCount ?? 0} closed
      </span>
    </div>
  );
}
