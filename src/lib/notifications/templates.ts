export const TEMPLATES = {
  DONATION_THANKS: {
    code: 'DONATION_THANKS',
    smsBody: (v: { name: string; amount: string; type: string; orgName: string }) =>
      `[${v.orgName}] ${v.name}님, ${v.amount} ${v.type} 후원 감사합니다.`,
  },
  RECEIPT_ISSUED: {
    code: 'RECEIPT_ISSUED',
    smsBody: (v: { name: string; year: string; orgName: string }) =>
      `[${v.orgName}] ${v.name}님, ${v.year}년 기부금 영수증이 발급되었습니다. 마이페이지에서 확인하세요.`,
  },
  BILLING_FAILED: {
    code: 'BILLING_FAILED',
    smsBody: (v: { name: string; amount: string; orgName: string }) =>
      `[${v.orgName}] ${v.name}님, ${v.amount} 정기후원 결제가 실패했습니다. 결제수단을 확인해 주세요.`,
  },
  BILLING_UPCOMING: {
    code: 'BILLING_UPCOMING',
    smsBody: (v: { name: string; date: string; amount: string; orgName: string }) =>
      `[${v.orgName}] ${v.name}님, ${v.date}에 ${v.amount} 정기후원이 결제됩니다.`,
  },
  BIRTHDAY_GREETING: {
    code: 'BIRTHDAY_GREETING',
    smsBody: (v: { name: string; orgName: string }) =>
      `[${v.orgName}] ${v.name}님의 생일을 진심으로 축하드립니다. 항상 따뜻한 후원에 감사드립니다.`,
  },
} as const;
