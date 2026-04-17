const BASE_URL = 'https://api-alimtalk.cloud.toast.com/alimtalk/v2.3/appkeys';

type SendResult = { success: boolean; error?: string };

export async function sendAlimtalk(
  phone: string,
  templateCode: string,
  templateParameter: Record<string, string>,
): Promise<SendResult> {
  const appKey = process.env.NHN_ALIMTALK_APP_KEY;
  const secretKey = process.env.NHN_ALIMTALK_SECRET_KEY;
  const senderKey = process.env.NHN_ALIMTALK_SENDER_KEY;

  if (!appKey || !secretKey || !senderKey) {
    console.warn('[alimtalk] NHN 알림톡 환경변수 미설정 — 건너뜀');
    return { success: false, error: '알림톡 설정 누락' };
  }

  try {
    const res = await fetch(`${BASE_URL}/${appKey}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json;charset=UTF-8',
        'X-Secret-Key': secretKey,
      },
      body: JSON.stringify({
        senderKey,
        templateCode,
        recipientList: [{ recipientNo: phone, templateParameter }],
      }),
    });

    const data = await res.json();
    if (data.header?.isSuccessful) return { success: true };
    console.warn('[alimtalk] 발송 실패:', data.header?.resultMessage);
    return { success: false, error: data.header?.resultMessage ?? '알림톡 발송 실패' };
  } catch (err) {
    console.error('[alimtalk] 네트워크 오류:', err);
    return { success: false, error: '알림톡 발송 중 오류' };
  }
}
