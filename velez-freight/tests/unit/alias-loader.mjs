// Lets node --test run TypeScript sources that use the "@/..." path alias.
import { register } from "node:module";
register("./alias-hooks.mjs", import.meta.url);
