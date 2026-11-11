import { z } from "zod";

// Shared parsing helpers for admin server actions (not a server action module itself).
export type ActionState = { ok?: boolean; error?: string; message?: string } | undefined;

export const values = <T extends readonly { value: string }[]>(l: T) => l.map((x) => x.value) as [string, ...string[]];
export const text = (max: number) => z.string().trim().max(max).optional().transform((v) => v || null);
export const optDate = z.string().trim().optional().transform((v) => v || null).pipe(z.union([z.null(), z.string().regex(/^\d{4}-\d{2}-\d{2}$/)]));
export const email = z.string().trim().toLowerCase().optional().transform((v) => v || null).pipe(z.union([z.null(), z.email()]));
export const digits = z.string().trim().optional().transform((v) => (v ?? "").replace(/\D/g, "") || null).pipe(z.union([z.null(), z.string().max(8)]));
export const uuid = z.uuid();
export const form = (fd: FormData) => Object.fromEntries(fd.entries()) as Record<string, string>;
export const fail = (e: unknown): ActionState => ({ error: e instanceof z.ZodError ? e.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ") : "Something went wrong. Please try again." });
