const BASE_URL = 'https://api-sms.cloud.toast.com/sms/v3.0/appKeys';

type SendResult = { success: boolean; error?: string };

export async function sendSms(phone: string, body: string): Promise<SendResult> {
  const appKey = process.env.NHN_SMS_APP_KEY;
  const secretKey = process.env.NHN_SMS_SECRET_KEY;
  const sender = process.env.NHN_SMS_SENDER;

  if (!appKey || !secretKey || !sender) {
    console.error('[SMS] NHN Cloud 환경변수 미설정');
    return { success: false, error: 'SMS 서비스 설정이 누락되었습니다.' };
  }

  try {
    const res = await fetch(`${BASE_URL}/${appKey}/sender/sms`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json;charset=UTF-8',
        'X-Secret-Key': secretKey,
      },
      body: JSON.stringify({
        body,
        sendNo: sender,
        recipientList: [{ recipientNo: phone }],
      }),
    });

    const data = await res.json();
    if (data.header?.isSuccessful) {
      return { success: true };
    }
    console.error('[SMS] 발송 실패:', data.header?.resultMessage);
    return { success: false, error: data.header?.resultMessage ?? 'SMS 발송 실패' };
  } catch (err) {
    console.error('[SMS] 네트워크 오류:', err);
    return { success: false, error: 'SMS 발송 중 오류가 발생했습니다.' };
  }
}
