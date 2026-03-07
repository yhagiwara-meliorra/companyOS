"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createServerSupabaseClient } from "../../lib/supabase/server";

const AuthSchema = z.object({
  email: z.string().email("有効なメールアドレスを入力してください"),
  password: z.string().min(8, "パスワードは8文字以上にしてください"),
  next: z.string().optional(),
});

function safeNext(input?: string) {
  if (!input) return "/threads/new";
  return input.startsWith("/") ? input : "/threads/new";
}

export async function signInAction(formData: FormData) {
  const parsed = AuthSchema.parse({
    email: formData.get("email"),
    password: formData.get("password"),
    next: formData.get("next"),
  });

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: parsed.email,
    password: parsed.password,
  });

  if (error) {
    redirect(`/auth?mode=signin&error=${encodeURIComponent(error.message)}&next=${encodeURIComponent(safeNext(parsed.next))}`);
  }

  redirect(safeNext(parsed.next));
}

export async function signUpAction(formData: FormData) {
  const parsed = AuthSchema.parse({
    email: formData.get("email"),
    password: formData.get("password"),
    next: formData.get("next"),
  });

  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.auth.signUp({
    email: parsed.email,
    password: parsed.password,
  });

  if (error) {
    redirect(`/auth?mode=signup&error=${encodeURIComponent(error.message)}&next=${encodeURIComponent(safeNext(parsed.next))}`);
  }

  if (!data.session) {
    redirect(`/auth?mode=signin&message=${encodeURIComponent("確認メールを送信しました。メール確認後にログインしてください。")}&next=${encodeURIComponent(safeNext(parsed.next))}`);
  }

  redirect(safeNext(parsed.next));
}

export async function signOutAction() {
  const supabase = await createServerSupabaseClient();
  await supabase.auth.signOut();
  redirect("/auth");
}

