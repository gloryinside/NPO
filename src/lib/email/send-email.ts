import nodemailer from 'nodemailer';

export async function sendEmail(params: {
  to: string;
  subject: string;
  html: string;
}): Promise<{ success: boolean; error?: string }> {
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM } =
    process.env;
  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) {
    console.error('[email] SMTP 환경변수 미설정');
    return { success: false, error: 'SMTP 설정 누락' };
  }
  try {
    const transporter = nodemailer.createTransport({
      host: SMTP_HOST,
      port: Number(SMTP_PORT) || 587,
      secure: Number(SMTP_PORT) === 465,
      auth: { user: SMTP_USER, pass: SMTP_PASS },
    });
    await transporter.sendMail({ from: SMTP_FROM ?? SMTP_USER, ...params });
    return { success: true };
  } catch (err) {
    console.error('[email] 발송 실패:', err);
    return { success: false, error: String(err) };
  }
}
