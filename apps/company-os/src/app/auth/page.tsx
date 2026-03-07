import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "../../lib/supabase/server";
import { signInAction, signUpAction } from "../../server/actions/auth";

export default async function AuthPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = (await searchParams) ?? {};
  const mode = params.mode === "signup" ? "signup" : "signin";
  const error = typeof params.error === "string" ? params.error : "";
  const message = typeof params.message === "string" ? params.message : "";
  const next = typeof params.next === "string" ? params.next : "/threads/new";

  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    redirect(next.startsWith("/") ? next : "/threads/new");
  }

  return (
    <div className="page-stack">
      <section className="hero-panel">
        <div className="eyebrow">Authentication</div>
        <h1 className="title">ログイン / アカウント作成</h1>
        <p className="subtitle">Thread作成にはログインが必要です。既存アカウントでログインするか、新規アカウントを作成してください。</p>
      </section>

      <section className="panel" style={{ maxWidth: 720 }}>
        <div className="split-header">
          <div>
            <h2 className="section-title">{mode === "signup" ? "アカウント作成" : "ログイン"}</h2>
            <p className="section-copy">メールアドレスとパスワードで認証します。</p>
          </div>
        </div>

        {error ? <p className="warning" style={{ marginTop: 16 }}>{error}</p> : null}
        {message ? <p className="success" style={{ marginTop: 16 }}>{message}</p> : null}

        <form action={mode === "signup" ? signUpAction : signInAction} className="field-grid" style={{ marginTop: 18 }}>
          <input type="hidden" name="next" value={next} />
          <div>
            <label className="label" htmlFor="email">Email</label>
            <input className="input" id="email" name="email" type="email" required />
          </div>
          <div>
            <label className="label" htmlFor="password">Password</label>
            <input className="input" id="password" name="password" type="password" minLength={8} required />
          </div>
          <div className="button-row">
            <button className="button primary" type="submit">{mode === "signup" ? "アカウント作成" : "ログイン"}</button>
            {mode === "signup" ? (
              <a className="button ghost" href={`/auth?mode=signin&next=${encodeURIComponent(next)}`}>ログインへ</a>
            ) : (
              <a className="button ghost" href={`/auth?mode=signup&next=${encodeURIComponent(next)}`}>新規作成へ</a>
            )}
          </div>
        </form>
      </section>
    </div>
  );
}

