import "server-only";
import { cache } from "react";

/**
 * Request scoped launch preview flag. Only the admin launch preview routes switch it on, and only
 * after requireAdmin() has verified the session on the server. Public routes never set it, so the
 * public website keeps its real operating status no matter what a visitor sends.
 */
const flag = cache(() => ({ on: false }));

export function enablePreviewMode() {
  flag().on = true;
}

export function isPreviewMode() {
  return flag().on;
}
