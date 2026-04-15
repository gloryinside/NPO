import DOMPurify from "isomorphic-dompurify";

/**
 * Sanitizes HTML string, removing XSS vectors.
 * Safe for both server (Node) and client (browser) via isomorphic-dompurify.
 */
export function sanitizeHtml(dirty: string): string {
  if (!dirty) return "";
  return DOMPurify.sanitize(dirty);
}

/**
 * Strips all HTML tags, returning plain text only.
 */
export function stripHtml(dirty: string): string {
  if (!dirty) return "";
  return DOMPurify.sanitize(dirty, { ALLOWED_TAGS: [], ALLOWED_ATTR: [] });
}
