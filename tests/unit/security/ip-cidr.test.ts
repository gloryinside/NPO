import { describe, expect, it } from "vitest";
import { isIpInAllowList, matchCidr } from "@/lib/security/ip-cidr";

describe("matchCidr", () => {
  it("/24 대역 매칭", () => {
    expect(matchCidr("1.2.3.4", "1.2.3.0/24")).toBe(true);
    expect(matchCidr("1.2.4.4", "1.2.3.0/24")).toBe(false);
  });

  it("단일 IP == /32", () => {
    expect(matchCidr("10.0.0.1", "10.0.0.1")).toBe(true);
    expect(matchCidr("10.0.0.2", "10.0.0.1")).toBe(false);
  });

  it("mask 0 은 모든 IP 허용", () => {
    expect(matchCidr("255.255.255.255", "0.0.0.0/0")).toBe(true);
  });

  it("잘못된 입력은 false", () => {
    expect(matchCidr("not-an-ip", "1.2.3.0/24")).toBe(false);
    expect(matchCidr("1.2.3.4", "garbage")).toBe(false);
    expect(matchCidr("999.999.999.999", "1.2.3.0/24")).toBe(false);
  });
});

describe("isIpInAllowList", () => {
  it("빈/undefined 목록은 true (화이트리스트 미활성)", () => {
    expect(isIpInAllowList("1.2.3.4", undefined)).toBe(true);
    expect(isIpInAllowList("1.2.3.4", "")).toBe(true);
    expect(isIpInAllowList("1.2.3.4", "   ")).toBe(true);
  });

  it("콤마 구분 다중 CIDR", () => {
    const csv = "10.0.0.0/8, 192.168.1.1, 203.0.113.0/24";
    expect(isIpInAllowList("10.5.5.5", csv)).toBe(true);
    expect(isIpInAllowList("192.168.1.1", csv)).toBe(true);
    expect(isIpInAllowList("203.0.113.100", csv)).toBe(true);
    expect(isIpInAllowList("8.8.8.8", csv)).toBe(false);
  });
});
