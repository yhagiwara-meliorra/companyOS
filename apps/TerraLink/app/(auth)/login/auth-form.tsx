"use client";

import { useState } from "react";
import { createClient } from "@/lib/auth/supabase-browser";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Loader2, Mail, CheckCircle2 } from "lucide-react";

type Mode = "login" | "signup";

export function AuthForm() {
  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [signupSuccess, setSignupSuccess] = useState(false);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setError(translateAuthError(error.message));
      setLoading(false);
      return;
    }

    window.location.href = "/app";
  }

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    if (password.length < 6) {
      setError("パスワードは6文字以上で入力してください。");
      setLoading(false);
      return;
    }

    if (password !== confirmPassword) {
      setError("パスワードが一致しません。");
      setLoading(false);
      return;
    }

    const supabase = createClient();
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    if (error) {
      setError(translateAuthError(error.message));
      setLoading(false);
      return;
    }

    // If user is auto-confirmed (no email confirmation required),
    // redirect directly to /app
    if (data?.session) {
      window.location.href = "/app";
      return;
    }

    // Otherwise show email confirmation screen
    setSignupSuccess(true);
    setLoading(false);
  }

  if (signupSuccess) {
    return (
      <Card>
        <CardContent className="py-8">
          <div className="flex flex-col items-center gap-4 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900">
              <Mail className="h-6 w-6 text-emerald-600" />
            </div>
            <div>
              <h3 className="text-lg font-semibold">確認メールを送信しました</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                <strong>{email}</strong> に確認メールを送信しました。
                <br />
                メール内のリンクをクリックして登録を完了してください。
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setSignupSuccess(false);
                setMode("login");
                setPassword("");
                setConfirmPassword("");
              }}
            >
              ログイン画面に戻る
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-4">
        <CardTitle className="text-center text-lg">
          {mode === "login" ? "ログイン" : "新規登録"}
        </CardTitle>
        <CardDescription className="text-center">
          {mode === "login"
            ? "メールアドレスとパスワードでログイン"
            : "アカウントを作成してはじめましょう"}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form
          onSubmit={mode === "login" ? handleLogin : handleSignup}
          className="space-y-4"
        >
          <div className="space-y-2">
            <Label htmlFor="email">メールアドレス</Label>
            <Input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              autoComplete="email"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">パスワード</Label>
            <Input
              id="password"
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={mode === "signup" ? "6文字以上" : ""}
              autoComplete={mode === "login" ? "current-password" : "new-password"}
            />
          </div>
          {mode === "signup" && (
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">パスワード（確認）</Label>
              <Input
                id="confirmPassword"
                type="password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="もう一度入力"
                autoComplete="new-password"
              />
            </div>
          )}
          {error && <p className="text-sm text-red-600">{error}</p>}
          <Button type="submit" disabled={loading} className="w-full">
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {mode === "login" ? "ログイン中..." : "登録中..."}
              </>
            ) : mode === "login" ? (
              "ログイン"
            ) : (
              "アカウントを作成"
            )}
          </Button>
        </form>

        <div className="mt-4 text-center text-sm text-muted-foreground">
          {mode === "login" ? (
            <>
              アカウントをお持ちでないですか？{" "}
              <button
                type="button"
                onClick={() => {
                  setMode("signup");
                  setError(null);
                }}
                className="font-medium text-primary underline-offset-4 hover:underline"
              >
                新規登録
              </button>
            </>
          ) : (
            <>
              すでにアカウントをお持ちですか？{" "}
              <button
                type="button"
                onClick={() => {
                  setMode("login");
                  setError(null);
                  setConfirmPassword("");
                }}
                className="font-medium text-primary underline-offset-4 hover:underline"
              >
                ログイン
              </button>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function translateAuthError(message: string): string {
  if (message.includes("Invalid login credentials")) {
    return "メールアドレスまたはパスワードが正しくありません。";
  }
  if (message.includes("Email not confirmed")) {
    return "メールアドレスが未確認です。確認メールのリンクをクリックしてください。";
  }
  if (message.includes("User already registered")) {
    return "このメールアドレスは既に登録されています。ログインしてください。";
  }
  if (message.includes("Password should be at least")) {
    return "パスワードは6文字以上で入力してください。";
  }
  if (message.includes("rate limit")) {
    return "リクエストが多すぎます。しばらく待ってからお試しください。";
  }
  if (message.includes("Email rate limit exceeded")) {
    return "メール送信の制限に達しました。しばらく待ってからお試しください。";
  }
  return message;
}
