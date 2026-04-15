import { describe, it, expect } from "vitest";
import {
  generateMemberCode,
  generatePromiseCode,
  generatePaymentCode,
  generateReceiptCode,
} from "@/lib/codes";

describe("generateMemberCode", () => {
  it("formats seq=1 correctly", () => {
    expect(generateMemberCode(2026, 1)).toBe("M-202600001");
  });

  it("formats seq=99999 correctly", () => {
    expect(generateMemberCode(2026, 99999)).toBe("M-202699999");
  });

  it("throws when seq=0", () => {
    expect(() => generateMemberCode(2026, 0)).toThrow(
      "sequence number must be positive"
    );
  });

  it("throws when seq=-1", () => {
    expect(() => generateMemberCode(2026, -1)).toThrow(
      "sequence number must be positive"
    );
  });

  it("throws when seq=100000", () => {
    expect(() => generateMemberCode(2026, 100000)).toThrow(
      "sequence number exceeds maximum (99999)"
    );
  });
});

describe("generatePromiseCode", () => {
  it("formats seq=42 correctly", () => {
    expect(generatePromiseCode(2026, 42)).toBe("P-202600042");
  });

  it("throws when seq=0", () => {
    expect(() => generatePromiseCode(2026, 0)).toThrow(
      "sequence number must be positive"
    );
  });

  it("throws when seq=-1", () => {
    expect(() => generatePromiseCode(2026, -1)).toThrow(
      "sequence number must be positive"
    );
  });

  it("throws when seq=100000", () => {
    expect(() => generatePromiseCode(2026, 100000)).toThrow(
      "sequence number exceeds maximum (99999)"
    );
  });
});

describe("generatePaymentCode", () => {
  it("formats seq=100 correctly", () => {
    expect(generatePaymentCode(2026, 100)).toBe("PMT-202600100");
  });

  it("throws when seq=0", () => {
    expect(() => generatePaymentCode(2026, 0)).toThrow(
      "sequence number must be positive"
    );
  });

  it("throws when seq=-1", () => {
    expect(() => generatePaymentCode(2026, -1)).toThrow(
      "sequence number must be positive"
    );
  });

  it("throws when seq=100000", () => {
    expect(() => generatePaymentCode(2026, 100000)).toThrow(
      "sequence number exceeds maximum (99999)"
    );
  });
});

describe("generateReceiptCode", () => {
  it("formats seq=1 correctly", () => {
    expect(generateReceiptCode(2026, 1)).toBe("RCP-2026-00001");
  });

  it("formats seq=99999 correctly", () => {
    expect(generateReceiptCode(2026, 99999)).toBe("RCP-2026-99999");
  });

  it("throws when seq=0", () => {
    expect(() => generateReceiptCode(2026, 0)).toThrow(
      "sequence number must be positive"
    );
  });

  it("throws when seq=-1", () => {
    expect(() => generateReceiptCode(2026, -1)).toThrow(
      "sequence number must be positive"
    );
  });

  it("throws when seq=100000", () => {
    expect(() => generateReceiptCode(2026, 100000)).toThrow(
      "sequence number exceeds maximum (99999)"
    );
  });
});
