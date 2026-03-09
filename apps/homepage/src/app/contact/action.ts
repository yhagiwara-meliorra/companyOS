"use server";

import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

const COMPANY_EMAIL = process.env.CONTACT_EMAIL || "contact@meliorra.co";
const FROM_EMAIL = process.env.FROM_EMAIL || "noreply@meliorra.co";

type ContactResult = {
  success: boolean;
  error?: string;
};

export async function submitContact(
  formData: FormData
): Promise<ContactResult> {
  const company = formData.get("company") as string;
  const name = formData.get("name") as string;
  const email = formData.get("email") as string;
  const phone = (formData.get("phone") as string) || "未入力";
  const type = formData.get("type") as string;
  const message = formData.get("message") as string;

  // Validation
  if (!company || !name || !email || !type || !message) {
    return { success: false, error: "必須項目を入力してください。" };
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return {
      success: false,
      error: "正しいメールアドレスを入力してください。",
    };
  }

  try {
    // 1. Send notification to company
    await resend.emails.send({
      from: `Meliorra お問い合わせ <${FROM_EMAIL}>`,
      to: COMPANY_EMAIL,
      subject: `【お問い合わせ】${type} - ${company} ${name}様`,
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #333; border-bottom: 2px solid #3549cb; padding-bottom: 12px;">
            新しいお問い合わせ
          </h2>
          <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
            <tr style="border-bottom: 1px solid #eee;">
              <td style="padding: 12px 8px; font-weight: bold; color: #666; width: 140px;">お問い合わせ種別</td>
              <td style="padding: 12px 8px;">${type}</td>
            </tr>
            <tr style="border-bottom: 1px solid #eee;">
              <td style="padding: 12px 8px; font-weight: bold; color: #666;">会社名</td>
              <td style="padding: 12px 8px;">${company}</td>
            </tr>
            <tr style="border-bottom: 1px solid #eee;">
              <td style="padding: 12px 8px; font-weight: bold; color: #666;">お名前</td>
              <td style="padding: 12px 8px;">${name}</td>
            </tr>
            <tr style="border-bottom: 1px solid #eee;">
              <td style="padding: 12px 8px; font-weight: bold; color: #666;">メールアドレス</td>
              <td style="padding: 12px 8px;"><a href="mailto:${email}">${email}</a></td>
            </tr>
            <tr style="border-bottom: 1px solid #eee;">
              <td style="padding: 12px 8px; font-weight: bold; color: #666;">電話番号</td>
              <td style="padding: 12px 8px;">${phone}</td>
            </tr>
          </table>
          <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin-top: 16px;">
            <h3 style="color: #333; margin-top: 0;">お問い合わせ内容</h3>
            <p style="color: #555; white-space: pre-wrap; line-height: 1.7;">${message}</p>
          </div>
        </div>
      `,
    });

    // 2. Send confirmation to the inquirer
    await resend.emails.send({
      from: `Meliorra株式会社 <${FROM_EMAIL}>`,
      to: email,
      subject: "【Meliorra】お問い合わせを受け付けました",
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #333; border-bottom: 2px solid #3549cb; padding-bottom: 12px;">
            お問い合わせありがとうございます
          </h2>
          <p style="color: #555; line-height: 1.8;">
            ${name} 様<br><br>
            この度はMeliorra株式会社にお問い合わせいただき、誠にありがとうございます。<br>
            以下の内容でお問い合わせを受け付けました。<br>
            内容を確認の上、担当者よりご連絡いたします。
          </p>
          <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 24px 0;">
            <table style="width: 100%; border-collapse: collapse;">
              <tr style="border-bottom: 1px solid #eee;">
                <td style="padding: 10px 8px; font-weight: bold; color: #666; width: 140px;">お問い合わせ種別</td>
                <td style="padding: 10px 8px; color: #333;">${type}</td>
              </tr>
              <tr style="border-bottom: 1px solid #eee;">
                <td style="padding: 10px 8px; font-weight: bold; color: #666;">会社名</td>
                <td style="padding: 10px 8px; color: #333;">${company}</td>
              </tr>
              <tr>
                <td style="padding: 10px 8px; font-weight: bold; color: #666;">お問い合わせ内容</td>
                <td style="padding: 10px 8px; color: #333; white-space: pre-wrap;">${message}</td>
              </tr>
            </table>
          </div>
          <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;" />
          <p style="color: #999; font-size: 13px; line-height: 1.7;">
            Meliorra株式会社<br>
            〒104-0061 東京都中央区銀座1-12-4 N&E BLD.7階<br>
            TEL: 050-3696-1474<br>
            <a href="https://meliorra.co" style="color: #3549cb;">https://meliorra.co</a>
          </p>
          <p style="color: #bbb; font-size: 12px;">
            ※ このメールは自動送信されています。このメールに返信されても対応できかねますので、ご了承ください。
          </p>
        </div>
      `,
    });

    return { success: true };
  } catch (err) {
    console.error("Email send error:", err);
    return {
      success: false,
      error: "メール送信中にエラーが発生しました。しばらくしてからお試しください。",
    };
  }
}
