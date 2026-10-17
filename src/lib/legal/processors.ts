/**
 * 플랫폼이 실제로 쓰는 처리 위탁·국외 이전 대상 — 처리방침(개인정보 보호법 제26조·제28조의8)에 그대로 싣는다.
 * 쓰는 서비스는 환경변수로 판단한다(키가 없으면 그 서비스로 개인정보가 가지 않는다).
 *
 * 시스템 운영사(PLATFORM_OPERATOR_NAME)도 기관 입장에서는 수탁자라 함께 싣는다.
 * DB 저장 위치는 배포 설정이라 코드가 알 수 없다 — DATA_STORAGE_LOCATION 에 운영 DB 리전을 적는다
 * (예: "대한민국(서울, AWS ap-northeast-2)"). 비어 있으면 처리방침과 점검표에 '확인 필요'로 표시된다.
 */

export type Processor = {
  name: string;
  task: string;
  items: string;
  /** null 이면 국내 */
  overseas: { country: string; when: string; how: string; site: string } | null;
};

export function storageLocation(): string | null {
  const v = process.env.DATA_STORAGE_LOCATION?.trim();
  return v ? v : null;
}

/** 저장 위치 문구가 대한민국이 아니면 국외 보관 */
export function isStoredOverseas(location: string | null): boolean {
  return location === null ? true : !/대한민국|한국|Korea|ap-northeast-2/i.test(location);
}

export function activeProcessors(env: NodeJS.ProcessEnv = process.env): Processor[] {
  const location = storageLocation();
  const list: Processor[] = [
    // 이 후원관리 시스템을 운영하는 곳 — 기관의 후원자 정보를 대신 처리하므로 수탁자다(PLATFORM_OPERATOR_NAME)
    {
      name: env.PLATFORM_OPERATOR_NAME?.trim() || "[후원관리 시스템 운영사 확인 필요]",
      task: "후원관리 시스템 운영·유지보수(후원자 정보 보관·처리)",
      items: "이 방침의 수집 항목 전체",
      overseas: null,
    },
    {
      name: "토스페이먼츠㈜",
      task: "후원금 결제 처리(카드·계좌), 정기결제 등록, 본인인증",
      items: "이름, 결제 정보, 휴대전화번호",
      overseas: null,
    },
    {
      name: "Supabase, Inc.",
      task: "후원자 정보 데이터베이스·파일 보관(서버 운영)",
      items: "이 방침의 수집 항목 전체(주민등록번호는 암호화 상태)",
      overseas: isStoredOverseas(location)
        ? { country: location ?? "[저장 위치 확인 필요]", when: "서비스 이용 시 수시", how: "암호화 통신망으로 전송", site: "https://supabase.com" }
        : null,
    },
    {
      name: "Vercel Inc.",
      task: "웹 서비스 운영(화면 제공·요청 처리)",
      items: "접속 기록, IP 주소, 신청 시 입력한 정보(처리 중 일시 경유)",
      overseas: { country: "미국 등 Vercel 서버 소재국", when: "서비스 이용 시 수시", how: "암호화 통신망으로 전송", site: "https://vercel.com" },
    },
  ];
  if (env.RESEND_API_KEY) {
    list.push({
      name: "Resend, Inc.",
      task: "이메일 발송(결제·영수증·후원 안내)",
      items: "이름, 이메일",
      overseas: { country: "미국", when: "이메일 발송 시", how: "암호화 통신망으로 전송", site: "https://resend.com" },
    });
  }
  if (env.NHN_SMS_APP_KEY || env.NHN_ALIMTALK_APP_KEY) {
    list.push({ name: "NHN Cloud㈜", task: "문자·카카오 알림톡 발송", items: "이름, 휴대전화번호", overseas: null });
  }
  if (env.UPSTASH_REDIS_REST_URL) {
    list.push({
      name: "Upstash, Inc.",
      task: "과도한 요청 차단(보안)",
      items: "IP 주소(짧은 시간 보관 후 자동 삭제)",
      overseas: { country: "Upstash 서버 소재국", when: "서비스 이용 시 수시", how: "암호화 통신망으로 전송", site: "https://upstash.com" },
    });
  }
  return list;
}
