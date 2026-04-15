import { describe, it, expect } from "vitest";
import { extractSlugFromHost } from "@/lib/tenant/resolver";

describe("extractSlugFromHost", () => {
  describe("프로덕션 서브도메인", () => {
    it("데모 서브도메인에서 slug를 추출한다", () => {
      expect(extractSlugFromHost("demo.supporters.kr")).toBe("demo");
    });

    it("hope 서브도메인에서 slug를 추출한다", () => {
      expect(extractSlugFromHost("hope.supporters.kr")).toBe("hope");
    });

    it("포트가 포함되어도 slug를 정확히 추출한다", () => {
      expect(extractSlugFromHost("demo.supporters.kr:443")).toBe("demo");
    });
  });

  describe("루트/예약 도메인", () => {
    it("루트 도메인은 null을 반환한다", () => {
      expect(extractSlugFromHost("supporters.kr")).toBeNull();
    });

    it("www 서브도메인은 null을 반환한다", () => {
      expect(extractSlugFromHost("www.supporters.kr")).toBeNull();
    });

    it("platform 서브도메인은 null을 반환한다 (슈퍼 어드민용 예약)", () => {
      expect(extractSlugFromHost("platform.supporters.kr")).toBeNull();
    });

    it("api 서브도메인은 null을 반환한다 (예약)", () => {
      expect(extractSlugFromHost("api.supporters.kr")).toBeNull();
    });

    it("admin 서브도메인은 null을 반환한다 (예약)", () => {
      expect(extractSlugFromHost("admin.supporters.kr")).toBeNull();
    });
  });

  describe("localhost 개발환경", () => {
    it("localhost:3000은 null을 반환한다 (서브도메인 없음)", () => {
      expect(extractSlugFromHost("localhost:3000")).toBeNull();
    });

    it("demo.localhost:3000은 demo를 반환한다", () => {
      expect(extractSlugFromHost("demo.localhost:3000")).toBe("demo");
    });

    it("hope.localhost:3000은 hope를 반환한다", () => {
      expect(extractSlugFromHost("hope.localhost:3000")).toBe("hope");
    });

    it("localhost (포트 없음)도 처리한다", () => {
      expect(extractSlugFromHost("localhost")).toBeNull();
    });

    it("demo.localhost (포트 없음)도 처리한다", () => {
      expect(extractSlugFromHost("demo.localhost")).toBe("demo");
    });
  });

  describe("예외 입력", () => {
    it("빈 문자열은 null을 반환한다", () => {
      expect(extractSlugFromHost("")).toBeNull();
    });

    it("슬러그가 예약어와 겹치면 null", () => {
      expect(extractSlugFromHost("www.localhost:3000")).toBeNull();
    });
  });
});
