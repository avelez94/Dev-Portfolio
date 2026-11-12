"use client";

import type { FieldValues, Resolver } from "react-hook-form";
import type { ZodType } from "zod";

/**
 * Same validation as zodResolver(schema), but the validation library and the schema load only
 * when a form is first validated. This keeps about 100 KB of compressed JavaScript off the
 * critical path of every page with a form. The server validates every submission regardless.
 */
export function lazyZodResolver<T extends FieldValues>(loadSchema: () => Promise<ZodType>): Resolver<T> {
  let ready: Promise<Resolver<T>> | null = null;
  const load = () =>
    (ready ??= Promise.all([import("@hookform/resolvers/zod"), loadSchema()]).then(
      ([{ zodResolver }, schema]) => zodResolver(schema as never) as unknown as Resolver<T>,
    ));
  return async (values, context, options) => (await load())(values, context, options);
}
