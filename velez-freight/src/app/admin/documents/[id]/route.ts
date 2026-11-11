import { NextResponse, type NextRequest } from "next/server";
import { getStaff } from "@/lib/auth";
import { audit } from "@/lib/data/audit";
import { serviceClient } from "@/lib/supabase/service";
import { DOCUMENT_BUCKET, RESTRICTED_DOC_TYPES } from "@/lib/documents";

const noStore = { "Cache-Control": "no-store", "X-Robots-Tag": "noindex" };

/**
 * Opens a stored document. Checks the session and the record (through Row Level Security),
 * limits W9 forms to owners and admins, logs the access, then redirects to a signed link that
 * expires after one minute. Storage keys and links are never shown in the page itself.
 */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const s = await getStaff();
  if (!s) return new NextResponse("Sign in required", { status: 401, headers: noStore });
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) return new NextResponse("Not found", { status: 404, headers: noStore });
  const { data: doc } = await s.db.from("documents").select("id, entity_type, entity_id, doc_type, storage_path, file_name").eq("id", id).maybeSingle();
  if (!doc?.storage_path) return new NextResponse("Not found", { status: 404, headers: noStore });
  if (RESTRICTED_DOC_TYPES.has(doc.doc_type) && s.role !== "owner" && s.role !== "admin") {
    return new NextResponse("This document requires owner or admin access", { status: 403, headers: noStore });
  }
  const svc = serviceClient();
  if (!svc) return new NextResponse("File storage is not connected", { status: 503, headers: noStore });
  const { data, error } = await svc.storage.from(DOCUMENT_BUCKET).createSignedUrl(doc.storage_path, 60, { download: doc.file_name ?? true });
  if (error || !data) return new NextResponse("The file could not be opened", { status: 502, headers: noStore });
  await audit({ actorType: "admin", actorId: s.userId, action: "document.opened", entityType: doc.entity_type, entityId: doc.entity_id, metadata: { document_id: doc.id, type: doc.doc_type } });
  return NextResponse.redirect(data.signedUrl, { status: 303, headers: noStore });
}
