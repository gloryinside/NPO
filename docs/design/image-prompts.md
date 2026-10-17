# 이미지 생성 프롬프트 (JobYLW 스타일 통일)

공통 스타일 — 모든 프롬프트 끝에 붙인다:

> Clean editorial line-art illustration, uniform 2px rounded strokes in deep navy (#20313a), flat fills limited to white and pale slate (#f1f5f9), a single soft mint blob (#e9f7ef) behind the subject, sparing accents in Younglimwon green (#009944) only on 1–2 small details. No gradients, no text, no logos, generous negative space, Korean context, friendly and calm.

산출물: `.webp`, 투명 배경(별도 명시 제외). 경로대로 `public/img/` 아래에 넣으면 된다.

## 1. 인증 사이드 패널 — 연결 완료
`public/img/auth/side.webp` · 세로 1080×1600 · **배경: 딥네이비 #0e202a(투명 아님)**
> Vertical composition on solid deep navy background (#0e202a). White line-art (2px strokes) of a donation journey stacked top to bottom, connected by one flowing green (#009944) path: an open hand holding a small heart, a coin dropping into a jar, a receipt with a check mark, a small house with a warm window, two people (adult and child) holding hands. Same outline style as a subway map. No text.

## 2. 빈 화면 일러스트 — 240×160, 투명 배경
| 파일 | 장면 |
|---|---|
| `empty/no-donors.webp` | 빈 의자 세 개와 하트 모양 말풍선 하나 |
| `empty/no-payments.webp` | 빈 카드 단말기와 코인 하나 |
| `empty/no-promises.webp` | 빈 달력과 연필, 작은 하트 스티커 |
| `empty/no-receipts.webp` | 빈 영수증 트레이와 접힌 종이 한 장 |
| `empty/no-campaigns.webp` | 비어 있는 모금함과 작은 깃발 |
| `empty/no-results.webp` | 돋보기와 물음표 |
| `empty/all-clear.webp` | 체크 표시가 있는 클립보드와 작은 새싹(그린 강조) |

> 프롬프트 템플릿: `Small spot illustration of {장면}, centered, transparent background.` + 공통 스타일

## 3. 오류·완료
| 파일 | 크기 | 장면 |
|---|---|---|
| `error/404.webp` | 480×320 | 끊어진 길 위 지도를 든 사람 |
| `error/500.webp` | 480×320 | 공구 상자 옆에서 톱니를 고치는 사람 |
| `success/donated.webp` | 480×320 | 하트를 상자에 넣는 손, 위로 작은 반짝임(그린) |
| `success/welcome-donor.webp` | 480×320 | 문 앞에서 손 흔드는 사람과 하트 화분 |

## 4. 공개 랜딩 기본 히어로 — 적용 완료 (Meta AI 워터마크 제거 후 사용)
`public/img/landing/hero-default.webp` · 2400×1000 · 배경: 딥네이비 그라디언트(#20313a→#0e202a)
> Wide hero on deep navy. Pale slate line-art of a Korean neighborhood street: volunteers carrying boxes, an elderly person receiving a meal, a child with a backpack, a community center building at right. Characters semi-transparent so a centered headline can sit on top; keep the middle third calm. Tiny green accents on 2 objects only.

## 5. 추가분 — 적용 완료 (2026-10-17)
받은 파일 중 `campaign/default-thumb.webp`와 `og/default.webp`는 내용이 서로 바뀌어 있어 이름을 바로잡아 넣었다.

| 파일 | 크기 | 쓰는 곳 |
|---|---|---|
| `img/campaign/default-thumb.webp` | 1200×800 | 썸네일 없는 캠페인 카드(공개 홈·랜딩 캠페인 섹션 4종). 다크 모드는 `art-adapt`로 반전 |
| `img/og/default.png` | 1200×630 | 기관 히어로 이미지·캠페인 이미지가 없을 때 링크 미리보기. 메신저 호환 위해 PNG |
| `img/landing/hero-monthly.webp` | 2304×960 | 템플릿 "정기후원 모집 첫 화면" |
| `img/landing/hero-yearend.webp` | 2304×960 | 새 템플릿 "연말 모금 첫 화면"(12/31까지 노출), 페이지 묶음 "연말 모금"의 첫 섹션 |
| `src/app/icon.png` · `apple-icon.png` · `favicon.ico` | 512 / 180 / 16·32·48 | 브라우저 탭·홈 화면 아이콘(Next 기본 파비콘 교체) |

- 기본 이미지 경로 상수: `src/lib/brand-images.ts`
- OG 상대 경로를 절대 URL로 만들기 위해 루트 레이아웃이 요청 호스트로 `metadataBase`를 정한다(기관별 도메인).
