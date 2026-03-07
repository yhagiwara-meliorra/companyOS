import { prettyJson } from "../../../../lib/format";
import { DecisionPacketSchema } from "../../../../domain/decision-packet.schema";
import { resumeApprovalAction } from "../../../../server/actions/resume-approval";
import { getApprovalByPacketId } from "../../../../server/repositories/approvals.repo";
import { getDecisionPacketById } from "../../../../server/repositories/decision-packets.repo";

export default async function ReviewDecisionPacketPage({ params }: { params: Promise<{ packetId: string }> }) {
  const { packetId } = await params;
  const [packetRow, approval] = await Promise.all([
    getDecisionPacketById(packetId),
    getApprovalByPacketId(packetId),
  ]);
  const packet = DecisionPacketSchema.parse(packetRow.packet_json);

  if (!approval) {
    throw new Error("Pending approval was not found for this packet.");
  }

  return (
    <div className="page-stack">
      <section className="hero-panel">
        <div className="eyebrow">Human Review</div>
        <h1 className="title">承認ゲートで止まっています</h1>
        <p className="subtitle">この packet は人間承認が必要です。approve / reject / edit のいずれかで再開し、LangGraph の interrupt を resume します。</p>
      </section>

      <div className="page-grid">
        <section className="panel section-stack">
          <h2 className="section-title">Approval reasons</h2>
          <ul className="list">
            {approval.reasons.map((reason: string) => <li key={reason}>{reason}</li>)}
          </ul>

          <div className="field-grid two">
            <div className="kv-card"><div className="kv-label">Packet status</div><div className="kv-value">{packetRow.status}</div></div>
            <div className="kv-card"><div className="kv-label">Decision</div><div className="kv-value">{packet.approval.finalDecision}</div></div>
            <div className="kv-card"><div className="kv-label">Cost impact</div><div className="kv-value">{packet.approval.estimatedCostImpactJPY ?? 0} JPY</div></div>
            <div className="kv-card"><div className="kv-label">CEO AI design change</div><div className="kv-value">{packet.approval.changesCeoAiDesign ? "Yes" : "No"}</div></div>
          </div>

          <form action={resumeApprovalAction} className="field-grid">
            <input type="hidden" name="packetId" value={packetId} />
            <input type="hidden" name="approvalId" value={approval.id} />

            <div>
              <label className="label" htmlFor="reviewAction">Review action</label>
              <select className="select" id="reviewAction" name="reviewAction" defaultValue="approve">
                <option value="approve">approve</option>
                <option value="edit">approve with edits</option>
                <option value="reject">reject</option>
              </select>
            </div>

            <div>
              <label className="label" htmlFor="reviewComment">Review comment</label>
              <textarea className="textarea" id="reviewComment" name="reviewComment" defaultValue="費用と設計変更の観点で確認済み。必要なら packet を調整して再開する。" />
            </div>

            <div>
              <label className="label" htmlFor="editedPacketJson">Edited packet JSON (edit のときのみ)</label>
              <textarea className="textarea" id="editedPacketJson" name="editedPacketJson" defaultValue={prettyJson(packet)} />
            </div>

            <div className="button-row">
              <button className="button primary" type="submit">承認して再開する</button>
              <a className="button ghost" href={`/decision-packets/${packetId}`}>Packet に戻る</a>
            </div>
          </form>
        </section>

        <aside className="sticky-column">
          <section className="panel section-stack">
            <h3 className="section-title">Human-in-the-loop</h3>
            <p className="section-copy">approve はそのまま続行、edit は packet を差し替えて続行、reject はこの packet を終了させます。</p>
            <div className="callout">実運用では durable checkpointer を使って resume の整合性を保ってください。</div>
          </section>
        </aside>
      </div>
    </div>
  );
}
