import { notFound } from "next/navigation";
import { createServerClient } from "@/lib/supabase/server";
import { Card } from "@/components/ui/card";
import { SafeMarkdown } from "@/components/ui/safe-markdown";
import Link from "next/link";

export default async function DigestDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createServerClient();

  const { data: digest } = await supabase
    .from("weekly_digests")
    .select("*, people(display_name)")
    .eq("id", id)
    .single() as { data: {
      id: string;
      week_start: string;
      digest_markdown: string;
      highlights: unknown;
      people: { display_name: string } | null;
      [key: string]: unknown;
    } | null };

  if (!digest) {
    notFound();
  }

  const people = digest.people;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link
          href="/dashboard/digests"
          className="text-sm text-primary-600 hover:text-primary-700"
        >
          &larr; ダイジェスト一覧へ戻る
        </Link>
      </div>

      <div>
        <h1 className="text-2xl font-bold text-slate-900">
          コーチングダイジェスト — {people?.display_name ?? "不明"}
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          対象週: {new Date(digest.week_start).toLocaleDateString("ja-JP")}
        </p>
      </div>

      <Card>
        <SafeMarkdown content={digest.digest_markdown} />
      </Card>

      {Array.isArray(digest.highlights) && (
        <Card>
          <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-slate-500">
            ハイライト
          </h3>
          <ul className="space-y-2">
            {(digest.highlights as { text: string }[]).map((h, i) => (
              <li key={i} className="text-sm text-slate-700">
                {h.text}
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
