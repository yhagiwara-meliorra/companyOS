"use client";

import { useState } from "react";
import { submitContact } from "./action";

const INQUIRY_TYPES = [
  "事業相談",
  "AI活用に関するご相談",
  "採用について",
  "メディア・取材",
  "その他",
];

type FormState = {
  status: "idle" | "submitting" | "success" | "error";
  message: string;
};

export default function ContactPage() {
  const [formState, setFormState] = useState<FormState>({
    status: "idle",
    message: "",
  });

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setFormState({ status: "submitting", message: "" });

    const formData = new FormData(e.currentTarget);
    const result = await submitContact(formData);

    if (result.success) {
      setFormState({
        status: "success",
        message:
          "お問い合わせありがとうございます。確認メールをお送りしましたので、ご確認ください。",
      });
      (e.target as HTMLFormElement).reset();
    } else {
      setFormState({
        status: "error",
        message: result.error || "送信に失敗しました。もう一度お試しください。",
      });
    }
  }

  return (
    <>
      <header className="header">
        <div className="container header-inner">
          <a href="/" className="logo">
            Meliorra<span>.</span>
          </a>
          <nav className="nav">
            <a href="/">トップページ</a>
          </nav>
        </div>
      </header>

      <main className="section" style={{ paddingTop: 140 }}>
        <div className="container">
          <div className="contact-layout">
            <div className="contact-info-col">
              <span className="section-label">Contact</span>
              <h1 className="section-title">お問い合わせ</h1>
              <p className="section-desc" style={{ marginBottom: 40 }}>
                事業構築やAI活用に関するご相談を承っております。
                以下のフォームよりお気軽にお問い合わせください。
                内容を確認の上、担当者よりご連絡いたします。
              </p>

              <div className="contact-details">
                <div className="contact-detail-item">
                  <p className="contact-detail-label">メール</p>
                  <a href="mailto:contact@meliorra.co">contact@meliorra.co</a>
                </div>
                <div className="contact-detail-item">
                  <p className="contact-detail-label">所在地</p>
                  <p>
                    〒104-0061
                    <br />
                    東京都中央区銀座1-12-4
                    <br />
                    N&E BLD.7階
                  </p>
                </div>
              </div>
            </div>

            <div className="contact-form-col">
              {formState.status === "success" ? (
                <div className="form-success">
                  <div className="form-success-icon">✓</div>
                  <h2>送信完了</h2>
                  <p>{formState.message}</p>
                  <a href="/" className="btn btn-outline" style={{ marginTop: 24 }}>
                    トップページに戻る
                  </a>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="contact-form">
                  <div className="form-row">
                    <div className="form-group">
                      <label htmlFor="company">会社名 *</label>
                      <input
                        type="text"
                        id="company"
                        name="company"
                        required
                        placeholder="株式会社○○"
                      />
                    </div>
                  </div>

                  <div className="form-row form-row-2col">
                    <div className="form-group">
                      <label htmlFor="name">お名前 *</label>
                      <input
                        type="text"
                        id="name"
                        name="name"
                        required
                        placeholder="山田 太郎"
                      />
                    </div>
                    <div className="form-group">
                      <label htmlFor="email">メールアドレス *</label>
                      <input
                        type="email"
                        id="email"
                        name="email"
                        required
                        placeholder="taro@example.com"
                      />
                    </div>
                  </div>

                  <div className="form-row form-row-2col">
                    <div className="form-group">
                      <label htmlFor="phone">電話番号</label>
                      <input
                        type="tel"
                        id="phone"
                        name="phone"
                        placeholder="03-1234-5678"
                      />
                    </div>
                    <div className="form-group">
                      <label htmlFor="type">お問い合わせ種別 *</label>
                      <select id="type" name="type" required>
                        <option value="">選択してください</option>
                        {INQUIRY_TYPES.map((t) => (
                          <option key={t} value={t}>
                            {t}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="form-row">
                    <div className="form-group">
                      <label htmlFor="message">お問い合わせ内容 *</label>
                      <textarea
                        id="message"
                        name="message"
                        required
                        rows={6}
                        placeholder="お問い合わせ内容をご記入ください"
                      />
                    </div>
                  </div>

                  <div className="form-row">
                    <p className="form-privacy">
                      送信いただいた内容は
                      <a href="/privacy" target="_blank" rel="noopener">
                        プライバシーポリシー
                      </a>
                      に基づき適切に管理いたします。
                    </p>
                  </div>

                  {formState.status === "error" && (
                    <div className="form-error">{formState.message}</div>
                  )}

                  <button
                    type="submit"
                    className="btn btn-primary btn-submit"
                    disabled={formState.status === "submitting"}
                  >
                    {formState.status === "submitting"
                      ? "送信中..."
                      : "送信する"}
                  </button>
                </form>
              )}
            </div>
          </div>
        </div>
      </main>

      <footer className="footer">
        <div className="container footer-inner">
          <p className="footer-copy">
            &copy; {new Date().getFullYear()} Meliorra株式会社
          </p>
          <div className="footer-links">
            <a href="/privacy">プライバシーポリシー</a>
          </div>
        </div>
      </footer>
    </>
  );
}
