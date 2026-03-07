import Link from "next/link";
import { DecisionPacketSchema } from "../../../domain/decision-packet.schema";
import { formatRelativeDate } from "../../../lib/format";
import { requestArtifactAction } from "../../../server/actions/request-artifact";
import { getApprovalByPacketId } from "../../../server/repositories/approvals.repo";
import { getDecisionPacketById, listArtifactsForPacket } from "../../../server/repositories/decision-packets.repo";

function ArtifactButton({ packetId, artifactType, label }: { packetId: string; artifactType: string; label: string }) {
  return (
    <form className="inline-form" action={requestArtifactAction}>
      <input type="hidden" name="packetId" value={packetId} />
      <input type="hidden" name="artifactType" value={artifactType} />
      <button className="button secondary" type="submit">{label}</button>
    </form>
  );
}

export default async function DecisionPacketPage({ params }: { params: Promise<{ packetId: string }> }) {
  const { packetId } = await params;
  const [packetRow, artifacts, approval] = await Promise.all([
    getDecisionPacketById(packetId),
    listArtifactsForPacket(packetId),
    getApprovalByPacketId(packetId),
  ]);
  const packet = DecisionPacketSchema.parse(packetRow.packet_json);

  return (
    <div className="page-stack">
      <section className="hero-panel">
        <div className="eyebrow">Decision Packet</div>
        <h1 className="title">{packet.metadata.title}</h1>
        <p className="subtitle">AI CEO の議論を、会社で再利用できる正規データに変換した状態です。ここから PRD / Build Plan / GTM brief を分岐生成します。</p>
        <div className="button-row" style={{ marginTop: 24 }}>
          <ArtifactButton packetId={packetId} artifactType="prd" label="PRD を作る" />
          <ArtifactButton packetId={packetId} artifactType="build_plan" label="Build Plan を作る" />
          <ArtifactButton packetId={packetId} artifactType="gtm_brief" label="GTM Brief を作る" />
          {packet.riskLegal.legalTriggerRequired ? (
            <ArtifactButton packetId={packetId} artifactType="legal_change_request" label="AI Legal へ渡す" />
          ) : null}
          {packetRow.status === "review_required" ? (
            <Link className="button primary" href={`/decision-packets/${packetId}/review`}>Review に進む</Link>
          ) : null}
        </div>
      </section>

      <div className="page-grid">
        <div className="content-grid">
          <section className="panel section-stack">
            <div className="split-header">
              <div>
                <h2 className="section-title">憲法整合性</h2>
                <p className="section-copy">Mission / Vision / Solve / Principles に照らした最初のゲートです。</p>
              </div>
              <span className={`badge ${packet.constitutionFit.constitutionDecision === "pass" ? "success" : packet.constitutionFit.constitutionDecision === "fail" ? "danger" : "warning"}`}>{packet.constitutionFit.constitutionDecision}</span>
            </div>
            <div className="kv-grid">
              <div className="kv-card"><div className="kv-label">Mission fit</div><div className="kv-value">{packet.constitutionFit.missionFit}</div></div>
              <div className="kv-card"><div className="kv-label">Vision fit</div><div className="kv-value">{packet.constitutionFit.visionFit}</div></div>
              <div className="kv-card"><div className="kv-label">Solve fit</div><div className="kv-value">{packet.constitutionFit.solveFit}</div></div>
              <div className="kv-card"><div className="kv-label">Misalignment</div><div className="kv-value">{packet.constitutionFit.misalignmentPoints.length ? packet.constitutionFit.misalignmentPoints.join(" / ") : "なし"}</div></div>
            </div>
          </section>

          <section className="panel section-stack">
            <h2 className="section-title">Problem / Solution</h2>
            <div className="kv-grid">
              <div className="kv-card"><div className="kv-label">Target customer</div><div className="kv-value">{packet.problemFrame.targetCustomer}</div></div>
              <div className="kv-card"><div className="kv-label">Target user</div><div className="kv-value">{packet.problemFrame.targetUser}</div></div>
              <div className="kv-card"><div className="kv-label">Core problem</div><div className="kv-value">{packet.problemFrame.coreProblem}</div></div>
              <div className="kv-card"><div className="kv-label">Solution concept</div><div className="kv-value">{packet.solutionFrame.solutionConcept}</div></div>
            </div>
            <div className="field-grid two">
              <div className="kv-card">
                <div className="kv-label">AI role</div>
                <ul className="list">{packet.solutionFrame.aiRole.map((item) => <li key={item}>{item}</li>)}</ul>
              </div>
              <div className="kv-card">
                <div className="kv-label">Human role</div>
                <ul className="list">{packet.solutionFrame.humanRole.map((item) => <li key={item}>{item}</li>)}</ul>
              </div>
            </div>
          </section>

          <section className="panel section-stack">
            <h2 className="section-title">MVP / Build / GTM</h2>
            <div className="field-grid two">
              <div className="kv-card">
                <div className="kv-label">In scope</div>
                <ul className="list">{packet.mvpScope.inScopeFeatures.map((item) => <li key={item}>{item}</li>)}</ul>
              </div>
              <div className="kv-card">
                <div className="kv-label">Out of scope</div>
                <ul className="list">{packet.mvpScope.outOfScopeFeatures.map((item) => <li key={item}>{item}</li>)}</ul>
              </div>
              <div className="kv-card">
                <div className="kv-label">Stack</div>
                <ul className="list">
                  <li>{packet.buildDirection.recommendedStack.frontend}</li>
                  <li>{packet.buildDirection.recommendedStack.backend}</li>
                  <li>{packet.buildDirection.recommendedStack.database}</li>
                  <li>{packet.buildDirection.recommendedStack.orchestration}</li>
                </ul>
              </div>
              <div className="kv-card">
                <div className="kv-label">Positioning</div>
                <div className="kv-value">{packet.gtm.positioning}</div>
              </div>
            </div>
          </section>

          <section className="panel section-stack">
            <h2 className="section-title">Risk / Contracts / Next Actions</h2>
            <div className="field-grid two">
              <div className="kv-card">
                <div className="kv-label">Legal risks</div>
                <ul className="list">{packet.riskLegal.legalRisks.map((item) => <li key={item}>{item}</li>)}</ul>
              </div>
              <div className="kv-card">
                <div className="kv-label">Implementation risks</div>
                <ul className="list">{packet.riskLegal.implementationRisks.map((item) => <li key={item}>{item}</li>)}</ul>
              </div>
              <div className="kv-card">
                <div className="kv-label">Required contracts</div>
                <ul className="list">{packet.riskLegal.requiredContracts.map((item) => <li key={item}>{item}</li>)}</ul>
              </div>
              <div className="kv-card">
                <div className="kv-label">Next actions</div>
                <ul className="list">{packet.execution.nextActions.map((item) => <li key={item}>{item}</li>)}</ul>
              </div>
            </div>
          </section>
        </div>

        <aside className="sticky-column">
          <section className="panel section-stack">
            <h3 className="section-title">Decision summary</h3>
            <div className="button-row">
              <span className={`badge ${packet.approval.finalDecision === "go" ? "success" : packet.approval.finalDecision === "hold" ? "warning" : "danger"}`}>{packet.approval.finalDecision}</span>
              <span className={`badge ${packetRow.status === "review_required" ? "warning" : packetRow.status === "approved" ? "success" : packetRow.status === "rejected" ? "danger" : "dim"}`}>{packetRow.status}</span>
            </div>
            <p className="section-copy">{packet.approval.decisionReason}</p>
            <div className="kv-card">
              <div className="kv-label">Cost impact</div>
              <div className="kv-value">{packet.approval.estimatedCostImpactJPY ?? 0} JPY</div>
            </div>
            <div className="kv-card">
              <div className="kv-label">Needs human approval</div>
              <div className="kv-value">{packet.approval.approvalRequired ? "Yes" : "No"}</div>
            </div>
            {approval ? (
              <div className="callout">承認レコードあり · {formatRelativeDate(approval.created_at)}</div>
            ) : null}
          </section>

          <section className="panel section-stack">
            <h3 className="section-title">Artifacts</h3>
            {artifacts.length ? (
              <table className="table">
                <thead>
                  <tr>
                    <th>Type</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {artifacts.map((artifact) => (
                    <tr key={artifact.id}>
                      <td><Link href={`/artifacts/${artifact.id}`}>{artifact.artifact_type}</Link></td>
                      <td>{artifact.status}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="muted-card">まだ成果物はありません。上のボタンから生成できます。</div>
            )}
          </section>
        </aside>
      </div>
    </div>
  );
}
