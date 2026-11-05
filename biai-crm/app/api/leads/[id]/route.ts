import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

const STAGE_REQUIRES_PROOF = new Set(["contacted", "interested", "paid"]);

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const { id } = await params;
  const leadId = Number(id);
  const body = await req.json();

  const existing = db.prepare("SELECT * FROM leads WHERE id = ?").get(leadId) as any;
  if (!existing) return NextResponse.json({ error: "Lead not found." }, { status: 404 });

  const updates: string[] = [];
  const values: any[] = [];
  const proofFiles = Array.isArray(body.proofFiles) ? body.proofFiles : Array.isArray(body.proof) ? body.proof : [];
  const nextStage = body.stage ?? existing.stage;

  if (body.stage && body.stage !== existing.stage) {
    if (nextStage === "lost") {
      // lost is allowed without proof
    } else if (STAGE_REQUIRES_PROOF.has(nextStage) && proofFiles.length === 0) {
      return NextResponse.json(
        { error: `Stage '${nextStage}' requires at least one PNG/JPEG proof attachment.` },
        { status: 400 }
      );
    }

    if (body.stage === "paid") {
      updates.push("coin_status = ?");
      values.push("eligible");
    }

    updates.push("stage = ?");
    values.push(body.stage);
    db.prepare(
      "INSERT INTO activity_log (lead_id, user_id, action, detail) VALUES (?, ?, 'stage_changed', ?)"
    ).run(leadId, user.id, `${existing.stage} -> ${body.stage}`);

    if (proofFiles.length > 0) {
      for (const file of proofFiles) {
        const name = typeof file?.name === "string" ? file.name : "proof.jpg";
        const mime = typeof file?.mime === "string" ? file.mime : "image/jpeg";
        const pathValue = typeof file?.path === "string" ? file.path : name;
        db.prepare(
          "INSERT INTO lead_stage_proof (lead_id, stage, file_name, file_path, file_mime, uploaded_by) VALUES (?, ?, ?, ?, ?, ?)"
        ).run(leadId, body.stage, name, pathValue, mime, user.id);
      }
    }
  }

  if (body.assigned_to !== undefined && body.assigned_to !== existing.assigned_to) {
    updates.push("assigned_to = ?");
    values.push(body.assigned_to);
    db.prepare(
      "INSERT INTO activity_log (lead_id, user_id, action, detail) VALUES (?, ?, 'reassigned', ?)"
    ).run(leadId, user.id, `Reassigned to user #${body.assigned_to}`);
  }

  if (body.take !== undefined) {
    if (body.take && !existing.taken_by) {
      updates.push("taken_by = ?", "taken_at = datetime('now')");
      values.push(user.id);
      db.prepare(
        "INSERT INTO activity_log (lead_id, user_id, action, detail) VALUES (?, ?, 'taken', ?)"
      ).run(leadId, user.id, `${user.name} took this lead`);
    } else if (!body.take && existing.taken_by) {
      updates.push("taken_by = NULL", "taken_at = NULL");
      db.prepare(
        "INSERT INTO activity_log (lead_id, user_id, action, detail) VALUES (?, ?, 'taken', ?)"
      ).run(leadId, user.id, "Released back to unclaimed");
    }
  }

  if (body.resolve !== undefined) {
    if (body.resolve && !existing.resolved_at) {
      updates.push("resolved_at = datetime('now')");
      db.prepare(
        "INSERT INTO activity_log (lead_id, user_id, action, detail) VALUES (?, ?, 'resolved', ?)"
      ).run(leadId, user.id, `Marked resolved by ${user.name}`);
    } else if (!body.resolve && existing.resolved_at) {
      updates.push("resolved_at = NULL");
      db.prepare(
        "INSERT INTO activity_log (lead_id, user_id, action, detail) VALUES (?, ?, 'resolved', ?)"
      ).run(leadId, user.id, "Reopened");
    }
  }

  if (body.escalated !== undefined && Boolean(body.escalated) !== Boolean(existing.escalated)) {
    updates.push("escalated = ?");
    values.push(body.escalated ? 1 : 0);
    db.prepare(
      "INSERT INTO activity_log (lead_id, user_id, action, detail) VALUES (?, ?, 'escalated', ?)"
    ).run(leadId, user.id, body.escalated ? "Escalated" : "De-escalated");
  }

  const editableFields = [
    "category",
    "priority",
    "lead_verdict",
    "lead_reasoning",
    "estimated_value",
    "suggested_reply",
  ] as const;
  const editedFields: string[] = [];
  for (const field of editableFields) {
    if (body[field] !== undefined && body[field] !== existing[field]) {
      updates.push(`${field} = ?`);
      values.push(body[field]);
      editedFields.push(field);
    }
  }
  if (editedFields.length > 0) {
    db.prepare(
      "INSERT INTO activity_log (lead_id, user_id, action, detail) VALUES (?, ?, 'edited', ?)"
    ).run(leadId, user.id, `Staff corrected: ${editedFields.join(", ")}`);
  }

  if (updates.length === 0) {
    return NextResponse.json({ ok: true, lead: existing });
  }

  updates.push("updated_at = datetime('now')");
  values.push(leadId);
  db.prepare(`UPDATE leads SET ${updates.join(", ")} WHERE id = ?`).run(...values);

  const lead = db.prepare("SELECT * FROM leads WHERE id = ?").get(leadId);
  return NextResponse.json({ ok: true, lead });
}
