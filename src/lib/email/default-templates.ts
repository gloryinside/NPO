/**
 * 시나리오별 기본 Tiptap JSON + subject.
 * DB에 커스텀 템플릿이 없을 때 폴백으로 사용.
 */

export type ScenarioKey =
  | 'donation_thanks'
  | 'offline_received'
  | 'receipt_issued'
  | 'billing_failed'
  | 'billing_reminder'
  | 'welcome'
  | 'member_invite';

export type VariableDef = { key: string; label: string; sample: string };

export type ScenarioMeta = {
  key: ScenarioKey;
  label: string;
  description: string;
  variables: VariableDef[];
  defaultSubject: string;
  defaultBodyJson: Record<string, unknown>;
};

function p(text: string): Record<string, unknown> {
  return { type: 'paragraph', content: [{ type: 'text', text }] };
}

function heading(text: string, level = 2): Record<string, unknown> {
  return { type: 'heading', attrs: { level }, content: [{ type: 'text', text }] };
}

function bold(text: string): Record<string, unknown> {
  return { type: 'text', text, marks: [{ type: 'bold' }] };
}

function textNode(text: string): Record<string, unknown> {
  return { type: 'text', text };
}

function pMixed(...nodes: Record<string, unknown>[]): Record<string, unknown> {
  return { type: 'paragraph', content: nodes };
}

export const SCENARIOS: ScenarioMeta[] = [
  {
    key: 'donation_thanks',
    label: '후원 완료 감사',
    description: '결제 완료 시 후원자에게 발송되는 감사 이메일',
    variables: [
      { key: 'name', label: '후원자명', sample: '홍길동' },
      { key: 'amount', label: '후원 금액', sample: '50,000원' },
      { key: 'type', label: '후원 유형', sample: '일시' },
      { key: 'orgName', label: '기관명', sample: '희망나눔재단' },
      { key: 'campaignTitle', label: '캠페인명', sample: '아동교육 지원' },
      { key: 'paymentCode', label: '결제번호', sample: 'PAY-20260417-001' },
      { key: 'date', label: '결제일', sample: '2026. 4. 17.' },
    ],
    defaultSubject: '[{{orgName}}] 후원 완료 — {{amount}}',
    defaultBodyJson: {
      type: 'doc',
      content: [
        heading('후원해 주셔서 감사합니다'),
        pMixed(bold('{{name}}'), textNode('님, {{orgName}}에 소중한 후원을 해주셔서 진심으로 감사드립니다.')),
        p('아래는 후원 내역입니다.'),
        pMixed(textNode('캠페인: '), bold('{{campaignTitle}}')),
        pMixed(textNode('후원 유형: '), bold('{{type}} 후원')),
        pMixed(textNode('후원 금액: '), bold('{{amount}}')),
        pMixed(textNode('결제일: '), bold('{{date}}')),
        pMixed(textNode('결제번호: {{paymentCode}}')),
        p('따뜻한 나눔에 다시 한번 감사드립니다.'),
      ],
    },
  },
  {
    key: 'offline_received',
    label: '오프라인 접수 안내',
    description: '계좌이체/CMS 후원 신청 접수 시 발송',
    variables: [
      { key: 'name', label: '후원자명', sample: '홍길동' },
      { key: 'amount', label: '후원 금액', sample: '30,000원' },
      { key: 'orgName', label: '기관명', sample: '희망나눔재단' },
      { key: 'campaignTitle', label: '캠페인명', sample: '아동교육 지원' },
      { key: 'paymentCode', label: '접수번호', sample: 'PAY-20260417-002' },
      { key: 'payMethod', label: '결제수단', sample: '계좌이체' },
      { key: 'bankName', label: '은행명', sample: '국민은행' },
      { key: 'bankAccount', label: '계좌번호', sample: '123-456-789012' },
      { key: 'accountHolder', label: '예금주', sample: '희망나눔재단' },
    ],
    defaultSubject: '[{{orgName}}] {{payMethod}} 후원 신청이 접수되었습니다',
    defaultBodyJson: {
      type: 'doc',
      content: [
        heading('후원 신청이 접수되었습니다'),
        pMixed(bold('{{name}}'), textNode('님의 {{payMethod}} 후원 신청이 정상적으로 접수되었습니다.')),
        pMixed(textNode('캠페인: '), bold('{{campaignTitle}}')),
        pMixed(textNode('신청 금액: '), bold('{{amount}}')),
        pMixed(textNode('접수번호: {{paymentCode}}')),
        p('은행: {{bankName}}'),
        p('계좌번호: {{bankAccount}}'),
        p('예금주: {{accountHolder}}'),
        p('입금 시 이름(후원자명)을 기재해 주세요. 입금 확인 후 후원이 처리됩니다.'),
      ],
    },
  },
  {
    key: 'receipt_issued',
    label: '영수증 발급 완료',
    description: '기부금 영수증 발급 시 발송',
    variables: [
      { key: 'name', label: '후원자명', sample: '홍길동' },
      { key: 'orgName', label: '기관명', sample: '희망나눔재단' },
      { key: 'year', label: '귀속연도', sample: '2025' },
      { key: 'totalAmount', label: '기부 합계', sample: '600,000원' },
      { key: 'receiptCode', label: '영수증 번호', sample: 'RCP-2025-001' },
      { key: 'pdfUrl', label: 'PDF 링크', sample: 'https://example.com/receipt.pdf' },
    ],
    defaultSubject: '[{{orgName}}] {{year}}년 기부금 영수증 발급 완료',
    defaultBodyJson: {
      type: 'doc',
      content: [
        heading('기부금 영수증이 발급되었습니다'),
        pMixed(bold('{{name}}'), textNode('님, {{year}}년 기부금 영수증이 발급되었습니다.')),
        pMixed(textNode('기부 합계: '), bold('{{totalAmount}}')),
        pMixed(textNode('영수증 번호: {{receiptCode}}')),
        p('아래 링크에서 PDF를 다운로드하실 수 있습니다.'),
        p('{{pdfUrl}}'),
      ],
    },
  },
  {
    key: 'billing_failed',
    label: '자동결제 실패',
    description: '정기후원 자동결제 실패 시 후원자에게 발송',
    variables: [
      { key: 'name', label: '후원자명', sample: '홍길동' },
      { key: 'orgName', label: '기관명', sample: '희망나눔재단' },
      { key: 'amount', label: '결제 금액', sample: '50,000원' },
      { key: 'reason', label: '실패 사유', sample: '카드 한도 초과' },
    ],
    defaultSubject: '[{{orgName}}] 자동결제 실패 안내',
    defaultBodyJson: {
      type: 'doc',
      content: [
        heading('자동결제가 실패했습니다'),
        pMixed(bold('{{name}}'), textNode('님, {{orgName}} 정기후원 자동결제가 실패했습니다.')),
        pMixed(textNode('결제 금액: '), bold('{{amount}}')),
        pMixed(textNode('실패 사유: {{reason}}')),
        p('카드 정보를 확인하시거나, 기관으로 문의해 주세요.'),
      ],
    },
  },
  {
    key: 'billing_reminder',
    label: '결제 예정 안내',
    description: '정기후원 결제 D-3 사전 안내',
    variables: [
      { key: 'name', label: '후원자명', sample: '홍길동' },
      { key: 'orgName', label: '기관명', sample: '희망나눔재단' },
      { key: 'amount', label: '결제 금액', sample: '50,000원' },
      { key: 'date', label: '결제 예정일', sample: '2026. 4. 20.' },
    ],
    defaultSubject: '[{{orgName}}] 정기후원 결제 예정 안내',
    defaultBodyJson: {
      type: 'doc',
      content: [
        heading('결제 예정 안내'),
        pMixed(bold('{{name}}'), textNode('님, {{orgName}} 정기후원 결제가 예정되어 있습니다.')),
        pMixed(textNode('결제 예정일: '), bold('{{date}}')),
        pMixed(textNode('결제 금액: '), bold('{{amount}}')),
        p('계속적인 나눔에 감사드립니다.'),
      ],
    },
  },
  {
    key: 'welcome',
    label: '가입 환영',
    description: '신규 후원자 가입 시 발송',
    variables: [
      { key: 'name', label: '후원자명', sample: '홍길동' },
      { key: 'orgName', label: '기관명', sample: '희망나눔재단' },
    ],
    defaultSubject: '[{{orgName}}] 환영합니다, {{name}}님!',
    defaultBodyJson: {
      type: 'doc',
      content: [
        heading('환영합니다!'),
        pMixed(bold('{{name}}'), textNode('님, {{orgName}}에 오신 것을 환영합니다.')),
        p('앞으로 따뜻한 나눔의 여정을 함께해 주세요.'),
        p('궁금한 점이 있으시면 언제든 문의해 주세요.'),
      ],
    },
  },
  {
    key: 'member_invite',
    label: '후원자 로그인 초대',
    description: '관리자가 비회원(로그인 계정 미연결) 후원자에게 발송',
    variables: [
      { key: 'name', label: '후원자명', sample: '홍길동' },
      { key: 'orgName', label: '기관명', sample: '희망나눔재단' },
      { key: 'email', label: '후원자 이메일', sample: 'donor@example.com' },
      { key: 'loginUrl', label: '로그인 링크', sample: 'https://example.org/donor/login' },
    ],
    defaultSubject: '[{{orgName}}] 후원자 페이지로 로그인해보세요',
    defaultBodyJson: {
      type: 'doc',
      content: [
        heading('후원자 전용 페이지 안내'),
        pMixed(bold('{{name}}'), textNode('님, {{orgName}}에 후원해주셔서 감사합니다.')),
        p('후원자 전용 페이지에 로그인하시면 다음 기능을 이용하실 수 있습니다.'),
        p('• 지금까지의 후원 내역 확인'),
        p('• 기부금 영수증 발급·다운로드'),
        p('• 정기후원 약정 상태 관리'),
        p('아래 링크에서 회원님 이메일({{email}})로 로그인해 주세요. 기존 후원 내역이 자동으로 연결됩니다.'),
        p('{{loginUrl}}'),
        p('이 메일은 {{orgName}}의 관리자가 1회 안내 목적으로 발송했습니다.'),
      ],
    },
  },
];

export function getScenario(key: ScenarioKey): ScenarioMeta {
  const found = SCENARIOS.find((s) => s.key === key);
  if (!found) throw new Error(`Unknown email scenario: ${key}`);
  return found;
}

export function getSampleVariables(key: ScenarioKey): Record<string, string> {
  const scenario = getScenario(key);
  const map: Record<string, string> = {};
  for (const v of scenario.variables) {
    map[v.key] = v.sample;
  }
  return map;
}
