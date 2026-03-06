import Link from "next/link";
import { formatRelativeDate } from "../../lib/format";
import { listPendingApprovals } from "../../server/repositories/approvals.repo";

export default async function ApprovalsPage() {
  const approvals = await listPendingApprovals();

  return (
    <div className="page-stack">
      <section className="hero-panel">
        <div className="eyebrow">Approvals</div>
        <h1 className="title">承認待ちキュー</h1>
        <p className="subtitle">人間判断に残したい境界を、ここで止めます。10万円以上の費用変動や CEO AI 設計変更はこの画面から review へ送ります。</p>
      </section>

      <section className="panel">
        {approvals.length ? (
          <table className="table">
            <thead>
              <tr>
                <th>Packet</th>
                <th>Reasons</th>
                <th>Requested</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {approvals.map((approval) => (
                <tr key={approval.id}>
                  <td><Link href={`/decision-packets/${approval.decision_packet_id}/review`}>{approval.decision_packet_id}</Link></td>
                  <td>{approval.reasons.join(" / ")}</td>
                  <td>{formatRelativeDate(approval.created_at)}</td>
                  <td>{approval.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="muted-card">現在、承認待ちはありません。</div>
        )}
      </section>
    </div>
  );
}
