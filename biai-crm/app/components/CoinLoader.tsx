"use client";

import { useEffect, useRef, useState } from "react";

// Ported 1:1 from components/coin/coin.tsx + coin-loader.tsx (pure CSS 3D
// transforms, no three.js) — same spin/wobble/toss physics and timing as
// the original gyro-circle source and the biai_crm_ui.html mockup.
const EDGE_LAYERS = 22;
const MIN_SPIN_MS = 3600;
const TOSS_SECONDS = 1.9;

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

export default function CoinLoader({ onFinish }: { onFinish: () => void }) {
  const [hidden, setHidden] = useState(false);
  const [caption, setCaption] = useState("LOADING");
  const coinRef = useRef<HTMLDivElement>(null);
  const shadowRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const coin = coinRef.current!;
    const shadow = shadowRef.current!;

    // Build the rim out of stacked edge layers.
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
    let phase: "spinning" | "tossing" | "done" = "spinning";
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let velocity = random(220, 380);
    let targetVelocity = velocity;
    let nextChange = 0;
    const wobblePhase = [random(0, 6.28), random(0, 6.28), random(0, 6.28)];
    let elapsed = 0;
    let last = performance.now();
    const startedAt = performance.now();
    let toss: {
      startedAt: number;
      from: Pose;
      driftX: number;
      peak: number;
      depth: number;
      flipSpeed: number;
      spinSpeed: number;
      axisTilt: number;
    } | null = null;
    let raf = 0;
    let cancelled = false;

    function finish() {
      phase = "done";
      setHidden(true);
      onFinish();
    }

    function render(now: number) {
      if (cancelled) return;
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;
      elapsed += dt;

      if (phase === "spinning") {
        if (now - startedAt > MIN_SPIN_MS) phase = "tossing";
        if (elapsed > nextChange) {
          targetVelocity = Math.random() < 0.2 ? random(560, 820) : random(150, 460);
          nextChange = elapsed + random(0.9, 2.6);
        }
        velocity += (targetVelocity - velocity) * Math.min(1, dt * 1.6);
        const speed = reduceMotion ? 90 : velocity;
        pose.rotateY = (pose.rotateY + speed * dt) % 360;
        pose.rotateX =
          8 + Math.sin(elapsed * 1.3 + wobblePhase[0]) * 7 + Math.sin(elapsed * 0.47 + wobblePhase[1]) * 4;
        pose.rotateZ = Math.sin(elapsed * 0.9 + wobblePhase[2]) * 6;
        pose.y = Math.sin(elapsed * 2.1) * 4;
        pose.x = 0;
        pose.z = 0;
        const facing = applyCoinPose(coin, pose);
        coin.style.opacity = "1";
        shadow.style.opacity = "1";
        shadow.style.transform = `scaleX(${Math.max(facing, 0.12)})`;
      } else if (phase === "tossing") {
        if (!toss) {
          toss = {
            startedAt: now,
            from: { ...pose },
            driftX: random(-1, 1) * window.innerWidth * 0.14,
            peak: random(0.18, 0.26) * window.innerHeight,
            depth: random(2200, 3200),
            flipSpeed: random(1500, 2300) * (Math.random() < 0.5 ? -1 : 1),
            spinSpeed: random(-260, 260),
            axisTilt: random(-28, 28),
          };
          setCaption("READY");
        }
        const t = Math.min((now - toss.startedAt) / 1000 / TOSS_SECONDS, 1);
        const seconds = t * TOSS_SECONDS;
        const launch = Math.min(seconds / 0.18, 1);
        pose.x = toss.from.x + toss.driftX * easeOutQuad(t);
        pose.y = toss.from.y - toss.peak * Math.sin(Math.PI * Math.min(t * 0.85, 1)) * 1.1 + t * t * 60;
        pose.z = -toss.depth * easeInCubic(t) - 260 * easeOutQuad(t);
        pose.rotateX = toss.from.rotateX + toss.flipSpeed * seconds * launch * (1 - t * 0.35);
        pose.rotateY = toss.from.rotateY + toss.spinSpeed * seconds;
        pose.rotateZ = toss.from.rotateZ + toss.axisTilt * easeOutQuad(t);
        applyCoinPose(coin, pose);
        coin.style.opacity = String(t < 0.72 ? 1 : 1 - (t - 0.72) / 0.28);
        shadow.style.opacity = String(Math.max(0, 1 - t * 4));
        shadow.style.transform = `scaleX(${Math.max(0.1, 1 - t * 3)})`;
        if (t >= 1) {
          finish();
          return;
        }
      }
      raf = requestAnimationFrame(render);
    }
    raf = requestAnimationFrame(render);

    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div id="loader" className={hidden ? "hide" : ""}>
      <div className="coin-stage">
        <div className="coin" id="coin-el" ref={coinRef}>
          <div className="coin-face coin-face-front">
            <div className="coin-face-surface">
              <svg
                className="coin-emblem"
                viewBox="-100 -100 200 200"
                style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}
              >
                <defs>
                  <clipPath id="emblemClip">
                    <circle r="100" />
                  </clipPath>
                </defs>
                <g clipPath="url(#emblemClip)">
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
                  boxShadow:
                    "inset 0 0 0 2px rgba(255,255,255,.18), inset 0 -8px 18px rgba(60,20,0,.25)",
                }}
              />
              <div className="coin-shine" />
              <div className="coin-shade" />
            </div>
          </div>
          <div className="coin-face coin-face-back">
            <div className="coin-face-surface">
              <div className="coin-face-ring" />
              <svg viewBox="0 0 200 200" style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}>
                <text x="100" y="108" textAnchor="middle" fill="#151515" fontSize="34" fontWeight="700" letterSpacing="6">
                  BIAI
                </text>
                <g fill="#2a2a2a" fontSize="5.6" fontWeight="600" letterSpacing=".6" textAnchor="middle">
                  <text x="100" y="124">BANGLADESH INSTITUTE OF</text>
                  <text x="100" y="133">ARTIFICIAL INTELLIGENCE</text>
                </g>
                <line x1="78" y1="142" x2="122" y2="142" stroke="#b94a10" strokeWidth="0.8" />
                <text x="100" y="153" textAnchor="middle" fill="#b94a10" fontSize="5.4" fontWeight="700" letterSpacing="1">
                  START BUILDING WITH AI
                </text>
                <circle cx="100" cy="52" r="5" fill="#b94a10" />
              </svg>
              <div className="coin-shine" />
              <div className="coin-shade" />
            </div>
          </div>
        </div>
      </div>
      <div id="coin-shadow" ref={shadowRef} />
      <div className="loader-label" style={{ marginTop: 22 }}>{caption}</div>
      <div className="loader-sub">Spinning up BIAI CRM…</div>
    </div>
  );
}
