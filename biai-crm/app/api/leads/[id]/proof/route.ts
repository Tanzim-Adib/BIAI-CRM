import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import fs from "fs/promises";
import path from "path";
import crypto from "crypto";

const MAX_FILE_BYTES = 5 * 1024 * 1024;

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  const { id } = await params;
  const leadId = Number(id);
  const lead = db.prepare("SELECT id FROM leads WHERE id = ?").get(leadId);
  if (!lead) return NextResponse.json({ error: "Lead not found." }, { status: 404 });

  const form = await req.formData();
  const stage = String(form.get("stage") || "");
  if (!["contacted", "interested", "paid"].includes(stage)) return NextResponse.json({ error: "Choose a valid proof stage." }, { status: 400 });
  const files = form.getAll("files").filter((file): file is File => file instanceof File);
  if (!files.length || files.length > 5) return NextResponse.json({ error: "Attach between 1 and 5 proof images." }, { status: 400 });

  const folder = path.join(process.cwd(), "data", "uploads", String(leadId));
  await fs.mkdir(folder, { recursive: true });
  const saved: Array<{ id: number; fileName: string; stage: string }> = [];
  for (const file of files) {
    const ext = path.extname(file.name).toLowerCase();
    if (!([".png", ".jpg", ".jpeg"].includes(ext)) || !(["image/png", "image/jpeg"].includes(file.type))) {
      return NextResponse.json({ error: "Only PNG and JPEG files are allowed." }, { status: 400 });
    }
    if (!file.size || file.size > MAX_FILE_BYTES) return NextResponse.json({ error: "Each image must be under 5 MB." }, { status: 400 });
    const buffer = Buffer.from(await file.arrayBuffer());
    const isPng = buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10]));
    const isJpeg = buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
    if ((file.type === "image/png" && !isPng) || (file.type === "image/jpeg" && !isJpeg)) return NextResponse.json({ error: "The uploaded file content does not match its image type." }, { status: 400 });

    const fileName = `${crypto.randomUUID()}${ext}`;
    const fullPath = path.join(folder, fileName);
    await fs.writeFile(fullPath, buffer, { flag: "wx" });
    const result = db.prepare("INSERT INTO lead_stage_proof (lead_id, stage, file_name, file_path, file_mime, uploaded_by) VALUES (?, ?, ?, ?, ?, ?)")
      .run(leadId, stage, file.name, fullPath, file.type, user.id);
    saved.push({ id: Number(result.lastInsertRowid), fileName: file.name, stage });
  }
  return NextResponse.json({ ok: true, uploads: saved });
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  const { id } = await params;
  const proofId = Number(new URL(req.url).searchParams.get("proofId"));
  const proof = db.prepare("SELECT * FROM lead_stage_proof WHERE id = ? AND lead_id = ?").get(proofId, Number(id)) as any;
  if (!proof) return NextResponse.json({ error: "Proof not found." }, { status: 404 });
  const bytes = await fs.readFile(proof.file_path);
  return new NextResponse(bytes, { headers: { "Content-Type": proof.file_mime, "Content-Disposition": `inline; filename="${path.basename(proof.file_name)}"`, "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" } });
}
