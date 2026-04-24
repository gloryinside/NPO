import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { issueReauthToken, verifyReauthToken } from "@/lib/auth/reauth";

describe("reauth token", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-24T12:00:00Z"));
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("갓 발급된 토큰은 같은 memberId로 검증 통과", () => {
    const token = issueReauthToken("mem-1");
    expect(verifyReauthToken(token, "mem-1")).toBe(true);
  });

  it("다른 memberId로는 검증 실패", () => {
    const token = issueReauthToken("mem-1");
    expect(verifyReauthToken(token, "mem-2")).toBe(false);
  });

  it("30분 이내는 유효, 이후는 만료", () => {
    const token = issueReauthToken("mem-1");
    vi.advanceTimersByTime(29 * 60 * 1000);
    expect(verifyReauthToken(token, "mem-1")).toBe(true);
    vi.advanceTimersByTime(2 * 60 * 1000); // +2min → 31분 경과
    expect(verifyReauthToken(token, "mem-1")).toBe(false);
  });

  it("변조된 토큰은 검증 실패", () => {
    const token = issueReauthToken("mem-1");
    const tampered = token.slice(0, -4) + "xxxx";
    expect(verifyReauthToken(tampered, "mem-1")).toBe(false);
  });

  it("잘못된 형식의 토큰은 검증 실패", () => {
    expect(verifyReauthToken("not-a-token", "mem-1")).toBe(false);
    expect(verifyReauthToken("", "mem-1")).toBe(false);
  });
});
