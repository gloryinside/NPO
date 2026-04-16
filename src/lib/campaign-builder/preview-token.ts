import { randomBytes, timingSafeEqual } from 'node:crypto';

export function generatePreviewToken(): string {
  return randomBytes(16).toString('base64url');
}

export function verifyPreviewToken(
  stored: string | null | undefined,
  provided: string | null | undefined,
): boolean {
  if (!stored || !provided) return false;
  const a = Buffer.from(stored);
  const b = Buffer.from(provided);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
