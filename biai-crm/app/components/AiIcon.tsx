import Image from "next/image";

// Replaces the "✨" emoji placeholder used while the mockup's own AI icon
// hadn't been supplied yet. public/ai-sparkle.png is the icon given directly.
export default function AiIcon({ size = 14, style }: { size?: number; style?: React.CSSProperties }) {
  return (
    <Image
      src="/ai-sparkle.png"
      alt=""
      width={size}
      height={size}
      style={{ display: "inline-block", verticalAlign: "-2px", ...style }}
    />
  );
}
