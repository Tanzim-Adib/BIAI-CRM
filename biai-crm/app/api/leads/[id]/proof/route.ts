import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import fs from "fs";
import path from "path";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const { id } = await params;
  const leadId = Number(id);
  const existing = db.prepare("SELECT * FROM leads WHERE id = ?").get(leadId) as any;
  if (!existing) return NextResponse.json({ error: "Lead not found." }, { status: 404 });

  const formData = await req.formData();
  const files = formData.getAll("files");
  const uploads: any[] = [];

  for (const entry of files) {
    if (!(entry instanceof File)) continue;
    const mime = entry.type || "image/jpeg";
    if (!/^image\/(png|jpeg|jpg)$/.test(mime)) {
      return NextResponse.json({ error: "Only PNG and JPEG files are allowed." }, { status: 400 });
    }

    const folder = path.join(process.cwd(), "data", "uploads", String(leadId));
    fs.mkdirSync(folder, { recursive: true });
    const fileName = `${Date.now()}-${entry.name.replace(/[^a-zA-Z0-9_.-]/g, "_")}`;
    const filePath = path.join(folder, fileName);
    const buffer = Buffer.from(await entry.arrayBuffer());
    fs.writeFileSync(filePath, buffer);

    const stage = String(formData.get("stage") || existing.stage || "contacted");

    const res = db
      .prepare(
        "INSERT INTO lead_stage_proof (lead_id, stage, file_name, file_path, file_mime, uploaded_by) VALUES (?, ?, ?, ?, ?, ?)"
      )
      .run(leadId, stage, fileName, filePath, mime, user.id);

    uploads.push({ id: res.lastInsertRowid, fileName, stage, mime });
  }

  if (uploads.length === 0) {
    return NextResponse.json({ error: "No valid proof file was uploaded." }, { status: 400 });
  }

  return NextResponse.json({ ok: true, uploads });
}
