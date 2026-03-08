import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "プライバシーポリシー | Meliorra株式会社",
  description: "Meliorra株式会社のプライバシーポリシー",
};

export default function PrivacyPage() {
  return (
    <>
      <header className="header">
        <div className="container header-inner">
          <a href="/" className="logo">
            Meliorra<span>.</span>
          </a>
          <nav className="nav">
            <a href="/">トップページに戻る</a>
          </nav>
        </div>
      </header>
      <main className="section" style={{ paddingTop: 140 }}>
        <div className="container">
          <article className="privacy-content">
            <h1 className="section-title">プライバシーポリシー</h1>
            <p className="section-desc" style={{ marginBottom: 48 }}>
              Meliorra株式会社（以下「当社」といいます。）は、当社が提供するサービス、Webサイト、アプリケーションその他関連サービス（以下「本サービス」といいます。）における個人情報その他の利用者情報の取扱いについて、以下のとおりプライバシーポリシー（以下「本ポリシー」といいます。）を定めます。
            </p>

            <Section number="1" title="取得する情報">
              <p>
                当社は、本サービスの提供にあたり、以下の情報を取得することがあります。
              </p>
              <ol>
                <li>
                  氏名、会社名、部署名、役職、メールアドレス、電話番号等の連絡先情報
                </li>
                <li>アカウント情報、ログイン情報、認証情報</li>
                <li>問い合わせ内容、面談記録、サポート履歴</li>
                <li>
                  アップロードされたファイル、入力テキスト、プロンプト、指示内容、生成結果
                </li>
                <li>
                  端末情報、Cookie、IPアドレス、アクセスログ、利用履歴、エラーログ
                </li>
                <li>
                  支払に関する情報（ただし、カード情報等を決済代行会社が取得する場合を含みます。）
                </li>
                <li>採用応募に関する情報</li>
                <li>その他、当社が適法に取得する情報</li>
              </ol>
            </Section>

            <Section number="2" title="利用目的">
              <p>当社は、取得した情報を以下の目的で利用します。</p>
              <ol>
                <li>本サービスの提供、運営、保守及び改善のため</li>
                <li>本人確認、認証、アカウント管理のため</li>
                <li>問い合わせ対応、サポート対応及び連絡のため</li>
                <li>契約の締結及び履行、料金請求並びに取引管理のため</li>
                <li>
                  不正利用の防止、セキュリティ確保及びインシデント対応のため
                </li>
                <li>
                  サービス品質の分析、利用状況の把握及び統計データ作成のため
                </li>
                <li>新機能、更新情報、規約変更等の案内のため</li>
                <li>採用選考及び採用後の連絡のため</li>
                <li>法令対応、紛争対応その他これらに付随する目的のため</li>
              </ol>
            </Section>

            <Section number="3" title="個人情報の第三者提供">
              <p>
                当社は、法令に基づく場合その他個人情報保護法上認められる場合を除き、本人の同意なく個人データを第三者に提供しません。
              </p>
            </Section>

            <Section number="4" title="委託先への提供">
              <p>
                当社は、利用目的の達成に必要な範囲で、クラウド事業者、ホスティング事業者、認証事業者、決済代行会社、メール配信事業者、AIサービス提供事業者その他の委託先に対し、情報の取扱いを委託することがあります。この場合、当社は、委託先を適切に選定し、必要かつ適切な監督を行います。
              </p>
            </Section>

            <Section number="5" title="AIサービスの利用">
              <ol>
                <li>
                  当社は、本サービスの提供又は改善のためにAIサービスを利用することがあります。
                </li>
                <li>
                  当社が外部AIサービスを利用する場合、当社は、利用目的、入力範囲、保存条件及び必要な安全管理措置を考慮して利用します。
                </li>
                <li>
                  当社は、法令又は契約により許容される範囲を超えて、本人の個人情報を外部AIサービスに入力しません。
                </li>
              </ol>
            </Section>

            <Section number="6" title="Cookie等の利用">
              <p>
                当社は、本サービスの利便性向上、利用状況の把握、不正利用防止、広告配信の最適化その他の目的のため、Cookie、ローカルストレージその他類似技術を利用することがあります。利用者は、ブラウザ設定等によりCookieの制御を行うことができます。
              </p>
            </Section>

            <Section number="7" title="安全管理措置">
              <p>
                当社は、個人情報の漏えい、滅失又は毀損の防止その他個人情報の安全管理のため、組織的、人的、物理的及び技術的安全管理措置を講じます。主な内容は以下のとおりです。
              </p>
              <ol>
                <li>アクセス権限管理</li>
                <li>認証情報の適切な管理</li>
                <li>ログ管理及び監査</li>
                <li>通信の暗号化</li>
                <li>委託先管理</li>
                <li>インシデント対応体制の整備</li>
              </ol>
            </Section>

            <Section number="8" title="保有個人データに関する請求等">
              <p>
                当社は、保有個人データに関して、利用目的の通知、開示、訂正、追加、削除、利用停止、消去又は第三者提供の停止その他法令上認められる請求に対応します。請求方法の詳細は、下記問い合わせ窓口までご連絡ください。
              </p>
            </Section>

            <Section number="9" title="未成年者の情報">
              <p>
                未成年者が本サービスを利用する場合、必要に応じて法定代理人の同意を得た上で利用してください。
              </p>
            </Section>

            <Section number="10" title="外部送信・国外移転">
              <p>
                当社は、クラウドサービスその他の外部事業者を利用することに伴い、情報を外国に所在するサーバへ保存又は移転することがあります。法令上必要な場合には、必要な情報提供及び適切な措置を講じます。
              </p>
            </Section>

            <Section number="11" title="ポリシーの変更">
              <p>
                当社は、法令変更、サービス変更その他必要に応じて、本ポリシーを変更することがあります。重要な変更を行う場合は、本サービス上又は当社Webサイト上で周知します。
              </p>
            </Section>

            <Section number="12" title="お問い合わせ窓口">
              <dl className="company-grid" style={{ marginTop: 16 }}>
                <div className="company-item">
                  <dt>事業者名</dt>
                  <dd>Meliorra株式会社</dd>
                </div>
                <div className="company-item">
                  <dt>住所</dt>
                  <dd>
                    〒104-0061
                    <br />
                    東京都中央区銀座1-12-4 N&E BLD.7階
                  </dd>
                </div>
                <div className="company-item">
                  <dt>代表者</dt>
                  <dd>萩原　康仁</dd>
                </div>
                <div className="company-item">
                  <dt>問い合わせ先</dt>
                  <dd>
                    <a href="mailto:privacy@meliorra.co">
                      privacy@meliorra.co
                    </a>
                  </dd>
                </div>
                <div className="company-item">
                  <dt>受付方法</dt>
                  <dd>メール</dd>
                </div>
              </dl>
            </Section>

            <Section number="13" title="制定日・改定日">
              <p>制定日: 2026年3月8日</p>
            </Section>
          </article>
        </div>
      </main>
      <footer className="footer">
        <div className="container footer-inner">
          <p className="footer-copy">
            &copy; {new Date().getFullYear()} Meliorra株式会社
          </p>
          <div className="footer-links">
            <a href="/">トップページ</a>
          </div>
        </div>
      </footer>
    </>
  );
}

function Section({
  number,
  title,
  children,
}: {
  number: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section style={{ marginBottom: 40 }}>
      <h2
        style={{
          fontSize: 20,
          fontWeight: 500,
          marginBottom: 16,
          color: "var(--text)",
        }}
      >
        {number}. {title}
      </h2>
      <div
        style={{
          fontSize: 15,
          color: "var(--text-soft)",
          lineHeight: 1.8,
        }}
      >
        {children}
      </div>
      <style>{`
        .privacy-content ol {
          padding-left: 24px;
          margin-top: 12px;
        }
        .privacy-content li {
          margin-bottom: 6px;
        }
      `}</style>
    </section>
  );
}
