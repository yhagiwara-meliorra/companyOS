import { ActivityFeed } from "./activity-feed";

export default function ActivityPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">アクティビティ</h1>
        <p className="mt-1 text-sm text-slate-500">
          日別のメッセージ分析を確認。
        </p>
      </div>
      <ActivityFeed />
    </div>
  );
}
