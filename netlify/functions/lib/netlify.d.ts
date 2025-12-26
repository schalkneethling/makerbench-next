/**
 * Netlify global object type declarations
 * Available in Netlify Functions runtime
 */
import type { NetlifyGlobal } from "@netlify/types";

declare global {
  const Netlify: NetlifyGlobal;
}

