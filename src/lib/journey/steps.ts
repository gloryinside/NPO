/**
 * 후원자 여정 메시지 단계 — 기관이 켜고 끄며 문구만 고친다(시점은 고정).
 * 문구에는 {{이름}} {{기관명}} {{금액}} {{시작일}} {{후원기간}} {{마이페이지}} 를 쓸 수 있다.
 */
export type JourneyStepKey = "welcome_d1" | "intro_d7" | "thanks_30d" | "anniversary" | "birthday";

export type JourneyStepDef = {
  key: JourneyStepKey;
  title: string;
  /** 언제 보내는지 — 화면 안내 문구 */
  when: string;
  /** 처음 설정 전 켜져 있는지 — thanks_30d는 예전 감사 편지 작업을 이어받아 켜 둔다 */
  defaultEnabled: boolean;
  /** 후원 요청이 들어갈 수 있는 안내라 마케팅 수신 동의자에게만 */
  needsMarketingConsent: boolean;
  defaultSubject: string;
  defaultBody: string;
};

export const JOURNEY_VARIABLES = ["이름", "기관명", "금액", "시작일", "후원기간", "마이페이지"] as const;
export type JourneyVariable = (typeof JOURNEY_VARIABLES)[number];

export const JOURNEY_STEPS: JourneyStepDef[] = [
  {
    key: "welcome_d1",
    title: "정기후원 시작 환영",
    when: "정기후원을 신청한 다음 날",
    defaultEnabled: false,
    needsMarketingConsent: false,
    defaultSubject: "{{이름}}님, 정기후원을 시작해 주셔서 고맙습니다",
    defaultBody:
      "{{이름}}님, {{기관명}}의 정기후원자가 되어 주셔서 진심으로 고맙습니다.\n\n매월 보내 주시는 {{금액}}은 도움이 필요한 이웃에게 꾸준히 전해집니다.\n후원 내역과 기부금영수증은 마이페이지에서 언제든 확인하실 수 있어요.\n\n{{마이페이지}}",
  },
  {
    key: "intro_d7",
    title: "사업 소개",
    when: "정기후원을 신청하고 7일 뒤 (마케팅 수신 동의자만)",
    defaultEnabled: false,
    needsMarketingConsent: true,
    defaultSubject: "{{이름}}님의 후원이 이렇게 쓰입니다",
    defaultBody:
      "{{이름}}님, 후원을 시작하신 지 일주일이 되었어요.\n\n{{기관명}}이 어떤 일을 하는지 조금 더 소개해 드리고 싶습니다.\n(이곳에 주요 사업과 최근 소식을 적어 주세요.)\n\n{{마이페이지}}",
  },
  {
    key: "thanks_30d",
    title: "첫 후원 한 달 감사",
    when: "처음 후원하고 30일 뒤",
    defaultEnabled: true,
    needsMarketingConsent: false,
    defaultSubject: "한 달 전, 보내주신 마음에 감사드립니다",
    defaultBody:
      "{{이름}}님, 한 달 전 보내 주신 {{금액}}이 지금도 소중하게 쓰이고 있습니다.\n\n후원자님의 마음이 만든 변화를 마이페이지에서 확인해 보세요.\n\n{{마이페이지}}",
  },
  {
    key: "anniversary",
    title: "정기후원 기념일",
    when: "정기후원을 시작한 날, 매년",
    defaultEnabled: false,
    needsMarketingConsent: false,
    defaultSubject: "{{이름}}님과 함께한 지 {{후원기간}}이 되었습니다",
    defaultBody:
      "{{이름}}님, {{시작일}}에 시작하신 정기후원이 오늘로 {{후원기간}}이 되었습니다.\n\n긴 시간 한결같이 함께해 주셔서 고맙습니다.\n\n{{마이페이지}}",
  },
  {
    key: "birthday",
    title: "생일 축하",
    when: "후원자 생일, 매년 (생년월일을 아는 후원자만)",
    defaultEnabled: false,
    needsMarketingConsent: false,
    defaultSubject: "{{이름}}님, 생일 축하드립니다",
    defaultBody: "{{이름}}님, 생일을 진심으로 축하드립니다.\n\n늘 함께해 주셔서 고맙습니다. {{기관명}} 드림",
  },
];

export const JOURNEY_STEP_KEYS = JOURNEY_STEPS.map((s) => s.key);

export function stepDef(key: string): JourneyStepDef | undefined {
  return JOURNEY_STEPS.find((s) => s.key === key);
}

export type JourneyStepRow = {
  step_key: string;
  enabled: boolean;
  channel: "email" | "alimtalk";
  subject: string;
  body: string;
};

export type EffectiveStep = JourneyStepDef & {
  enabled: boolean;
  channel: "email" | "alimtalk";
  subject: string;
  body: string;
  /** 기관이 한 번이라도 저장했는지 */
  customized: boolean;
};

/** 기관 설정과 기본값을 합친다 — 저장된 행이 없으면 기본값 */
export function effectiveSteps(rows: JourneyStepRow[]): EffectiveStep[] {
  return JOURNEY_STEPS.map((def) => {
    const row = rows.find((r) => r.step_key === def.key);
    return {
      ...def,
      enabled: row ? row.enabled : def.defaultEnabled,
      channel: row?.channel ?? "email",
      subject: row?.subject ?? def.defaultSubject,
      body: row?.body ?? def.defaultBody,
      customized: !!row,
    };
  });
}
