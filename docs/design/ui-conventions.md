# UI 규칙 — 확인창·알림 (2026-10-17)

브라우저 기본 `alert()` / `confirm()` / `prompt()`는 쓰지 않는다.
디자인·다크 모드를 따르지 않고, 모바일 인앱 브라우저(카카오톡 등)에서 막히거나 화면을 멈춘다.

| 하려는 것 | 쓸 것 |
|---|---|
| 되묻기(예/아니오) | `const confirm = useConfirm()` → `if (!(await confirm({ title, description, confirmText, tone })))` (`@/components/ui/confirm-dialog`, 루트 레이아웃에 Provider 있음) |
| 되돌리기 어려운 동작(삭제·해지·재청구) | 위와 같고 `tone: "danger"`, `confirmText`는 동작 이름("삭제", "해지") |
| 결과 알림 | `toast.success / toast.error / toast` (`sonner`). Toaster는 관리자·후원자 레이아웃과 `src/app/donate/layout.tsx`에 있음 |
| 텍스트 입력 받기 | 그 자리에 작은 입력란(인라인 폼) |
| 화면 안 오류 문구 | `role="alert"` 문단 |

컴포넌트 테스트에서 `useConfirm`을 쓰는 컴포넌트를 그리면 `<ConfirmProvider>`로 감싼다.
