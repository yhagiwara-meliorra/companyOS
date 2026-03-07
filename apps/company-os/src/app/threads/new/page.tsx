import { createThreadAction } from "../../../server/actions/create-thread";
import { createServerSupabaseClient } from "../../../lib/supabase/server";

const defaultConstitution = `Mission
責任ある意思決定を支援し、個人を強くする。

Vision
AIとの対話を通じて、課題発見・企画・実装・販売・改善を回し続ける会社を作る。

Human Approval
- 10万円以上の費用変動
- CEO AIの設計変更`;

const threadTypes = [
  ["new_product", "新プロダクト"],
  ["company_strategy", "会社戦略"],
  ["service_addition", "サービス追加"],
  ["go_to_market", "GTM / マーケ"],
  ["legal_policy_change", "法務・ポリシー変更"],
  ["pricing_change", "価格変更"],
  ["partnership", "提携"],
  ["other", "その他"],
] as const;

export default async function NewThreadPage() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return (
      <div className="page-stack">
        <section className="hero-panel">
          <div className="eyebrow">Authentication Required</div>
          <h1 className="title">ログインしてからスレッドを作成してください</h1>
          <p className="subtitle">
            Company Builder OS は意思決定ログをユーザー単位で管理します。まずログイン（未登録ならアカウント作成）を行ってください。
          </p>
          <div className="button-row" style={{ marginTop: 20 }}>
            <a className="button primary" href="/auth?mode=signin&next=%2Fthreads%2Fnew">ログインする</a>
            <a className="button ghost" href="/auth?mode=signup&next=%2Fthreads%2Fnew">アカウントを作成する</a>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="page-stack">
      <section className="hero-panel">
        <div className="eyebrow">AI CEO Intake</div>
        <h1 className="title">新しい経営議論を起票する</h1>
        <p className="subtitle">
          ここでは「チャットを始める」のではなく、意思決定の対象を固定します。スレッドを起票した後、AI CEO が憲法整合性・課題・解決案・MVP・リスクを構造化し、Decision Packet に変換します。
        </p>

        <div className="metric-grid">
          <div className="metric-card">
            <div className="metric-label">Step 1</div>
            <div className="metric-value">Thread</div>
            <div className="metric-copy">問いと背景を固定する。</div>
          </div>
          <div className="metric-card">
            <div className="metric-label">Step 2</div>
            <div className="metric-value">Decision Packet</div>
            <div className="metric-copy">AI CEO の出力を会社の正規オブジェクトに変換する。</div>
          </div>
          <div className="metric-card">
            <div className="metric-label">Step 3</div>
            <div className="metric-value">Artifact Fan-out</div>
            <div className="metric-copy">PRD / Build Plan / GTM に分岐する。</div>
          </div>
        </div>
      </section>

      <div className="page-grid">
        <section className="panel">
          <div className="split-header">
            <div>
              <h2 className="section-title">Thread 起票フォーム</h2>
              <p className="section-copy">後続の AI CEO 実行で迷わないよう、何を考えたいのかを短く強く固定します。</p>
            </div>
            <span className="badge dim">Dark / Modern UI</span>
          </div>

          <form action={createThreadAction} className="field-grid" style={{ marginTop: 24 }}>
            <div>
              <label className="label" htmlFor="title">Thread title</label>
              <input className="input" id="title" name="title" placeholder="例: AI CEO を核にした Company Builder OS を実装したい" required />
            </div>

            <div>
              <label className="label" htmlFor="threadType">Thread type</label>
              <select className="select" id="threadType" name="threadType" defaultValue="new_product">
                {threadTypes.map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="label" htmlFor="rawUserInput">CEO briefing</label>
              <textarea
                className="textarea"
                id="rawUserInput"
                name="rawUserInput"
                defaultValue={`解決したい課題:

なぜ今やるべきか:

想定顧客:

AIに任せたいこと:

人間が残すべき判断:

懸念しているコスト・法務・倫理論点:`}
                required
              />
            </div>

            <div>
              <label className="label" htmlFor="constitutionText">Constitution snapshot</label>
              <textarea className="textarea" id="constitutionText" name="constitutionText" defaultValue={defaultConstitution} required />
            </div>

            <div className="button-row">
              <button className="button primary" type="submit">スレッドを作成する</button>
              <a className="button ghost" href="/approvals">承認待ちを見る</a>
            </div>
          </form>
        </section>

        <aside className="sticky-column">
          <section className="panel">
            <h3 className="section-title">この画面の役割</h3>
            <ul className="list">
              <li>議論を問いとして固定する</li>
              <li>憲法のスナップショットを保存する</li>
              <li>あとで再実行しても同じ前提で比較できるようにする</li>
            </ul>
          </section>

          <section className="panel">
            <h3 className="section-title">起票時に入れると精度が上がるもの</h3>
            <ul className="list">
              <li>顧客の痛みが起きる具体的な場面</li>
              <li>既存の代替手段と不満</li>
              <li>やらないこと</li>
              <li>承認が必要そうな論点</li>
            </ul>
          </section>
        </aside>
      </div>
    </div>
  );
}
