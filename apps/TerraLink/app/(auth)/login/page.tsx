import { AuthForm } from "./auth-form";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; confirmed?: string }>;
}) {
  const params = await searchParams;

  return (
    <main className="flex min-h-screen items-center justify-center bg-muted/30 p-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-primary">
            <span className="text-lg font-bold text-primary-foreground">T</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight">TerraLink</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            生物多様性・サプライチェーン リスク管理
          </p>
        </div>
        {params.error === "auth" && (
          <div className="rounded-md bg-red-50 p-3 text-center text-sm text-red-600 dark:bg-red-950 dark:text-red-400">
            認証に失敗しました。もう一度お試しください。
          </div>
        )}
        {params.confirmed === "true" && (
          <div className="rounded-md bg-emerald-50 p-3 text-center text-sm text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400">
            メールアドレスの確認が完了しました。ログインしてください。
          </div>
        )}
        <AuthForm />
      </div>
    </main>
  );
}
