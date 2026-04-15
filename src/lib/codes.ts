/**
 * Code generation utilities for NPO donation management system.
 * All functions are pure with no side effects or DB calls.
 */

const MAX_SEQ = 99999;

function validateSeq(seq: number): void {
  if (seq < 1) {
    throw new Error("sequence number must be positive");
  }
  if (seq > MAX_SEQ) {
    throw new Error("sequence number exceeds maximum (99999)");
  }
}

function padSeq(seq: number): string {
  return String(seq).padStart(5, "0");
}

/** Format: M-{YYYY}{5digits}  e.g. M-202600001 */
export function generateMemberCode(year: number, seq: number): string {
  validateSeq(seq);
  return `M-${year}${padSeq(seq)}`;
}

/** Format: P-{YYYY}{5digits}  e.g. P-202600001 */
export function generatePromiseCode(year: number, seq: number): string {
  validateSeq(seq);
  return `P-${year}${padSeq(seq)}`;
}

/** Format: PMT-{YYYY}{5digits}  e.g. PMT-202600001 */
export function generatePaymentCode(year: number, seq: number): string {
  validateSeq(seq);
  return `PMT-${year}${padSeq(seq)}`;
}

/** Format: RCP-{YYYY}-{5digits}  e.g. RCP-2026-00001 */
export function generateReceiptCode(year: number, seq: number): string {
  validateSeq(seq);
  return `RCP-${year}-${padSeq(seq)}`;
}
