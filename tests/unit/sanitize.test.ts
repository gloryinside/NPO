import { describe, it, expect } from "vitest";
import { sanitizeHtml, stripHtml } from "@/lib/sanitize";

describe("sanitizeHtml", () => {
  it("strips <script> tags", () => {
    const result = sanitizeHtml("<b>bold</b><script>alert(1)</script>");
    expect(result).toBe("<b>bold</b>");
  });

  it("removes event handlers (onerror)", () => {
    const result = sanitizeHtml('<img src="x" onerror="alert(1)">');
    // event handler must be removed; src attribute may be kept
    expect(result).not.toContain("onerror");
    expect(result).not.toContain("alert");
  });

  it("removes javascript: href", () => {
    const result = sanitizeHtml("<a href=\"javascript:alert(1)\">click</a>");
    expect(result).not.toContain("javascript:");
    expect(result).toContain("click");
  });

  it("preserves safe HTML tags", () => {
    const result = sanitizeHtml("<b>bold</b><i>italic</i><p>paragraph</p>");
    expect(result).toContain("<b>bold</b>");
    expect(result).toContain("<i>italic</i>");
    expect(result).toContain("<p>paragraph</p>");
  });

  it("returns empty string for empty input", () => {
    expect(sanitizeHtml("")).toBe("");
  });
});

describe("stripHtml", () => {
  it("removes all HTML tags", () => {
    const result = stripHtml("<b>bold <i>italic</i></b>");
    expect(result).not.toContain("<");
    expect(result).not.toContain(">");
  });

  it("preserves text content", () => {
    const result = stripHtml("<b>bold <i>italic</i></b>");
    expect(result).toBe("bold italic");
  });

  it("returns empty string for empty input", () => {
    expect(stripHtml("")).toBe("");
  });

  it("returns plain text unchanged", () => {
    expect(stripHtml("plain text")).toBe("plain text");
  });
});
