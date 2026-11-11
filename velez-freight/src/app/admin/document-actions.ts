"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireStaff, type StaffSession } from "@/lib/auth";
import { audit } from "@/lib/data/audit";
import { serviceClient } from "@/lib/supabase/service";
import { ADMIN_ONLY_ENTITIES, DOCUMENT_BUCKET, DOCUMENT_TYPES, ENTITY_TABLES, MAX_DOCUMENT_BYTES, STORAGE_PATH, type DocumentEntity } from "@/lib/documents";
import type { ActionState } from "./form-helpers";

const entity = z.enum(["shipment", "carrier_lead", "shipper_prospect", "regulatory_credential"]);
const docType = z.enum(["rate_confirmation", "bol", "pod", "insurance_certificate", "carrier_agreement", "w9", "other", "authority_record", "surety_bond", "boc3_filing", "registration_record"]);
const opt = (max: number) => z.string().trim().max(max).optional().transform((v) => v || null);
const fail = (e: unknown): ActionState => ({ error: e instanceof z.ZodError ? e.issues.map((i) => i.message).join(" ") : "Something went wrong. Please try again." });

/** The record must exist and be visible to this person (checked through Row Level Security). */
async function canAttach(s: StaffSession, type: DocumentEntity, id: string) {
  if (ADMIN_ONLY_ENTITIES.has(type) && s.role !== "owner" && s.role !== "admin") return false;
  const { data } = await s.db.from(ENTITY_TABLES[type]).select("id").eq("id", id).maybeSingle();
  return Boolean(data);
}

export type UploadTicket = { ok: true; path: string; token: string } | { ok: false; error: string };

/**
 * Step 1 of an upload: checks the session, the record and the file, then issues a one time
 * signed upload URL for a randomly named key under that record's folder. The browser sends
 * the file straight to storage with it, so large scans never pass through this server.
 */
export async function prepareDocumentUpload(input: { entityType: string; entityId: string; fileName: string; contentType: string; size: number }): Promise<UploadTicket> {
  const s = await requireStaff();
  const parsed = z.object({
    entityType: entity, entityId: z.uuid(),
    fileName: z.string().trim().min(1).max(200),
    contentType: z.string().refine((t) => t in DOCUMENT_TYPES, "Upload a PDF or a photo (JPG, PNG, WEBP or HEIC)."),
    size: z.number().int().min(1, "That file is empty.").max(MAX_DOCUMENT_BYTES, "Files can be up to 15 MB."),
  }).safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "That file cannot be uploaded." };
  const v = parsed.data;
  if (!(await canAttach(s, v.entityType, v.entityId))) return { ok: false, error: "That record was not found." };
  const svc = serviceClient();
  if (!svc) return { ok: false, error: "File storage is not connected." };
  const path = `${v.entityType}/${v.entityId}/${randomUUID()}.${DOCUMENT_TYPES[v.contentType]}`;
  const { data, error } = await svc.storage.from(DOCUMENT_BUCKET).createSignedUploadUrl(path);
  if (error || !data) return { ok: false, error: "Could not start the upload. Please try again." };
  return { ok: true, path: data.path, token: data.token };
}

/**
 * Records a document. With a file, step 2 of an upload: the stored object is checked (it must
 * sit under this record's folder, exist, and be an accepted type and size) and its real size
 * and type are saved, not what the browser claimed.
 */
export async function recordDocument(_: ActionState, fd: FormData): Promise<ActionState> {
  const s = await requireStaff();
  let uploaded: string | null = null;
  try {
    const v = z.object({
      entity_type: entity, entity_id: z.uuid(), doc_type: docType,
      reference: opt(200), expires_on: z.string().optional().transform((x) => x || null), notes: opt(1000),
      storage_path: z.string().optional().transform((x) => x || null),
      file_name: z.string().trim().max(200).optional().transform((x) => x || null),
    }).parse(Object.fromEntries(fd.entries()));
    if (!(await canAttach(s, v.entity_type, v.entity_id))) return { error: "That record was not found." };

    let file: { file_name: string; file_size: number; content_type: string } | null = null;
    if (v.storage_path) {
      const m = STORAGE_PATH.exec(v.storage_path);
      if (!m || m[1] !== v.entity_type || m[2] !== v.entity_id) return { error: "That upload does not belong to this record." };
      const svc = serviceClient();
      if (!svc) return { error: "File storage is not connected." };
      const { data: taken } = await svc.from("documents").select("id").eq("storage_path", v.storage_path).maybeSingle();
      if (taken) return { error: "That file is already recorded." };
      // From here on this is a fresh upload for this record, so it is cleaned up on failure.
      uploaded = v.storage_path;
      const { data: info, error } = await svc.storage.from(DOCUMENT_BUCKET).info(v.storage_path);
      if (error || !info) return { error: "The upload did not finish. Please choose the file again." };
      const meta = info as unknown as { size?: number; contentType?: string; metadata?: { size?: number; mimetype?: string } };
      const size = Number(meta.size ?? meta.metadata?.size ?? 0);
      const type = String(meta.contentType ?? meta.metadata?.mimetype ?? "");
      if (!(type in DOCUMENT_TYPES) || size < 1 || size > MAX_DOCUMENT_BYTES) {
        await svc.storage.from(DOCUMENT_BUCKET).remove([v.storage_path]);
        return { error: "That file type or size is not accepted." };
      }
      file = { file_name: v.file_name ?? "document", file_size: size, content_type: type };
    }

    const { storage_path, file_name: _ignored, ...rest } = v;
    void _ignored;
    const { error } = await s.db.from("documents").insert({ ...rest, ...(file ? { storage_path, ...file } : {}), recorded_by: s.userId });
    if (error) throw error;
    uploaded = null;
    await audit({ actorType: "admin", actorId: s.userId, action: file ? "document.uploaded" : "document.recorded", entityType: v.entity_type, entityId: v.entity_id, metadata: { type: v.doc_type, ...(file ? { bytes: file.file_size, content_type: file.content_type } : {}) } });
    revalidatePath("/admin", "layout");
    return { ok: true, message: file ? "Document uploaded." : "Document recorded." };
  } catch (e) {
    return fail(e);
  } finally {
    // Never leave an orphaned file behind when the record could not be saved.
    if (uploaded && STORAGE_PATH.test(uploaded)) await serviceClient()?.storage.from(DOCUMENT_BUCKET).remove([uploaded]);
  }
}
