import DOMPurify from 'isomorphic-dompurify';

const ALLOWED_MIME = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/svg+xml',
]);
const MAX_BYTES = 5_242_880; // 5 MiB

export function validateAssetUpload(input: {
  mimeType: string;
  sizeBytes: number;
}): { ok: boolean; error?: string } {
  if (!ALLOWED_MIME.has(input.mimeType)) {
    return { ok: false, error: 'mime not allowed' };
  }
  if (input.sizeBytes <= 0 || input.sizeBytes > MAX_BYTES) {
    return { ok: false, error: 'size out of range' };
  }
  return { ok: true };
}

export function sanitizeSvg(svg: string): string {
  return DOMPurify.sanitize(svg, { USE_PROFILES: { svg: true, svgFilters: true } });
}

export function buildStoragePath(orgId: string, ext: string): string {
  const yyyyMm = new Date().toISOString().slice(0, 7);
  const uuid = crypto.randomUUID();
  return `${orgId}/${yyyyMm}/${uuid}.${ext.replace(/^\./, '')}`;
}
