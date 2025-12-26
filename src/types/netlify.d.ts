/**
 * Netlify global object type declarations
 * Available in Netlify Functions runtime (may be undefined in browser/test context)
 */
import type { NetlifyGlobal } from "@netlify/types";

declare global {
  const Netlify: NetlifyGlobal | undefined;
}
