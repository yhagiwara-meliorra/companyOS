import Link from "next/link";
import { formatRelativeDate } from "../../../lib/format";
import { runDecisionPacketAction } from "../../../server/actions/run-decision-packet";
import { getLatestPacketForThread, getLatestGraphRun, getThreadById, getThreadMessages } from "../../../server/repositories/threads.repo";

export default async function ThreadDetailPage({ params }: { params: Promise<{ threadId: string }> }) {
  const { threadId } = await params;
  const [thread, messages, latestPacket, latestRun] = await Promise.all([
    getThreadById(threadId),
    getThreadMessages(threadId),
    getLatestPacketForThread(threadId),
    getLatestGraphRun(threadId),
  ]);

  return (
    <div className="page-stack">
      <section className="hero-panel">
        <div className="eyebrow">Thread</div>
        <h1 className="title">{thread.title}</h1>
        <p className="subtitle">ここではスレッドの履歴を確認し、AI CEO 実行を走らせます。最新の Decision Packet がある場合は、そのまま packet に遷移できます。</p>
        <div className="button-row" style={{ marginTop: 24 }}>
          <form action={runDecisionPacketAction}>
            <input type="hidden" name="threadId" value={thread.id} />
            <button className="button primary" type="submit">AI CEO を実行する</button>
          </form>
          {latestPacket ? (
            <Link className="button secondary" href={`/decision-packets/${latestPacket.id}`}>最新 Packet を開く</Link>
          ) : null}
        </div>
      </section>

      <div className="page-grid">
        <div className="content-grid">
          <section className="panel">
            <div className="split-header">
              <div>
                <h2 className="section-title">Thread summary</h2>
                <p className="section-copy">Decision Packet を生成する前の、原文の問いとメタデータです。</p>
              </div>
              <span className={`badge ${thread.status === "in_review" ? "warning" : thread.status === "approved" ? "success" : thread.status === "rejected" ? "danger" : "dim"}`}>{thread.status}</span>
            </div>
            <div className="kv-grid" style={{ marginTop: 20 }}>
              <div className="kv-card">
                <div className="kv-label">Thread type</div>
                <div className="kv-value">{thread.thread_type}</div>
              </div>
              <div className="kv-card">
                <div className="kv-label">Created</div>
                <div className="kv-value">{formatRelativeDate(thread.created_at)}</div>
              </div>
              <div className="kv-card">
                <div className="kv-label">Latest packet</div>
                <div className="kv-value">{latestPacket ? `${latestPacket.status} · ${formatRelativeDate(latestPacket.updated_at)}` : "まだありません"}</div>
              </div>
              <div className="kv-card">
                <div className="kv-label">Latest run</div>
                <div className="kv-value">{latestRun ? `${latestRun.run_status} · ${formatRelativeDate(latestRun.started_at)}` : "未実行"}</div>
              </div>
            </div>
          </section>

          <section className="panel">
            <h2 className="section-title">Conversation log</h2>
            <div className="timeline" style={{ marginTop: 18 }}>
              {messages.map((message) => (
                <div className="timeline-item" key={message.id}>
                  <div className="timeline-meta">
                    <span>{message.role}</span>
                    <span>{message.actor_name ?? "system"}</span>
                    <span>{formatRelativeDate(message.created_at)}</span>
                  </div>
                  <div className="timeline-content">{message.content}</div>
                </div>
              ))}
            </div>
          </section>
        </div>

        <aside className="sticky-column">
          <section className="panel">
            <h3 className="section-title">次に起きること</h3>
            <ul className="list">
              <li>憲法整合性を確認</li>
              <li>課題・解決策・MVP を切る</li>
              <li>承認が必要なら review に送る</li>
              <li>承認後に PRD / Build Plan / GTM へ分岐</li>
            </ul>
          </section>

          <section className="panel">
            <h3 className="section-title">Raw input</h3>
            <pre className="code-block">{thread.raw_user_input}</pre>
          </section>
        </aside>
      </div>
    </div>
  );
}
