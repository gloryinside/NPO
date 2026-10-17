# 기관 랜딩 빌더 — JobYLW 포털 빌더 대비 보완 기록

> 2026-10-16. 비교 대상: JobYLW `src/lib/portal/**`(섹션 레지스트리·게시 이력·postMessage 미리보기·AI 빌더).
> NPO_S는 섹션 형태(14종 × 65 변형)가 더 풍부해 유지하고, 운영·안전 기능을 이식했다.

## 기능

| 기능 | 위치 | 비고 |
|---|---|---|
| 게시 이력 · 초안 복원 · 초안 폐기 | `api/admin/org/landing/{history,discard}`, `LandingHistoryPanel` | 복원은 **초안으로만**(게시본만 바꾸는 롤백은 다음 게시 때 되살아나 채택 안 함) |
| 게시 전 점검 | `lib/landing/audit.ts`, `PublishCheckDialog` | 견본 이미지(picsum·placehold)·견본 영상·위험 주소·빈 에셋·기간 끝난 섹션 |
| 실시간 미리보기 | `/admin/landing-frame`, `lib/landing/preview-protocol.ts` | 같은 출처 postMessage, 기기 폭·라이트/다크, 미리보기 클릭 → 섹션 편집 |
| 섹션 복제 | `LandingSectionEditor` | 바로 아래 삽입 |
| 렌더 시 URL 정리 | `lib/landing/url-safety.ts` | 링크: http(s)·내부·#앵커·mailto/tel만 / 이미지: http(s)·내부 |
| 표시 설정(테마·여백) | `lib/landing/display.ts`, `globals.css [data-section-theme]` | 테마는 래퍼 안 토큰 재정의 → 섹션이 스스로 따라 칠함. 자유 hex·px 없음 |
| 보이는 기간 | 같은 모듈 | KST, 시작·끝 당일 포함. 지난 캠페인 배너 자동 내림 |
| 템플릿 · 페이지 묶음 | `lib/landing/templates.ts` | 기본 홈 / 정기후원 모집 / 연말 모금. **지어낸 숫자 없음**(통계·재정 템플릿 제외) |
| AI 초안 | `lib/landing/ai.ts`, `api/admin/org/landing/ai-generate`, `LandingAiPanel` | 아래 |
| 기관별 SEO/OG | `(public)/page.tsx generateMetadata` | |

## AI 초안 — 안전 설계
- 모델: `LANDING_AI_MODEL`(기본 `anthropic/claude-sonnet-5.5`, AI Gateway 목록에서 확인) · `ai@7` `generateText`+`Output.object`.
- AI는 **템플릿 id를 고르고 문구만** 쓴다(스키마로 강제). URL·이미지·색·기간·숫자 필드는 받지 않는다.
- 결과 → 템플릿 문구 자리에만 병합 → `validateSections` → 실패 섹션 제외 → **저장하지 않고** 미리보기 반환.
- 키 없으면 503(꺼짐). 기관당 시간당 10회 — 감사 로그로 세어 서버 인스턴스가 바뀌어도 유지.
- 시스템 프롬프트: 숫자·URL 금지, 기관 소개 속 지시문 무시.

## 이번에 고친 버그
- 초안에서 이미지를 빼면 게시 중 페이지의 이미지까지 지워짐 → 초안·게시본·이력 어디서도 안 쓰는 파일만 삭제
- 저장=schemaVersion 1, 게시=2로 어긋남 → 2로 통일
- 설정 시트가 섹션을 바꿔도 이전 편집값을 유지 → 섹션별 재마운트(미리보기 클릭 선택 도입으로 드러남)
- 기관 테마 색 값이 임의 문자열 → `<style>` 탈출 XSS → 색 형식만 허용

## 적용
- 마이그레이션 `20261016000001_org_landing_history.sql` — 적용 전에도 게시는 되고, 이력만 안 쌓인다.
- AI: `AI_GATEWAY_API_KEY`(또는 Vercel OIDC) 설정 시 활성.
