import Link from "next/link";
import { formatRelativeDate } from "../../../lib/format";
import { getArtifactById } from "../../../server/repositories/artifacts.repo";

export default async function ArtifactDetailPage({ params }: { params: Promise<{ artifactId: string }> }) {
  const { artifactId } = await params;
  const artifact = await getArtifactById(artifactId);

  return (
    <div className="page-stack">
      <section className="hero-panel">
        <div className="eyebrow">Artifact</div>
        <h1 className="title">{artifact.title}</h1>
        <p className="subtitle">Decision Packet から派生した成果物です。ここからドキュメント整形、公開、再生成へ進みます。</p>
        <div className="button-row" style={{ marginTop: 24 }}>
          <Link className="button secondary" href={`/decision-packets/${artifact.decision_packet_id}`}>Packet に戻る</Link>
        </div>
      </section>

      <div className="page-grid">
        <section className="panel section-stack">
          <h2 className="section-title">Generated content</h2>
          <pre className="code-block">{artifact.content_markdown ?? "No markdown content"}</pre>
        </section>

        <aside className="sticky-column">
          <section className="panel section-stack">
            <h3 className="section-title">Artifact metadata</h3>
            <div className="kv-card"><div className="kv-label">Type</div><div className="kv-value">{artifact.artifact_type}</div></div>
            <div className="kv-card"><div className="kv-label">Status</div><div className="kv-value">{artifact.status}</div></div>
            <div className="kv-card"><div className="kv-label">Created</div><div className="kv-value">{formatRelativeDate(artifact.created_at)}</div></div>
          </section>
        </aside>
      </div>
    </div>
  );
}
