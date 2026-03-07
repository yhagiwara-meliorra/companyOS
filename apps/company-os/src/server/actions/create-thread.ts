"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { ensureDefaultOrganization } from "../repositories/organizations.repo";
import { createThread } from "../repositories/threads.repo";

const CreateThreadInputSchema = z.object({
  title: z.string().min(1, "タイトルを入力してください"),
  threadType: z.enum([
    "company_strategy",
    "new_product",
    "service_addition",
    "go_to_market",
    "legal_policy_change",
    "pricing_change",
    "partnership",
    "other",
  ]),
  rawUserInput: z.string().min(20, "AI CEO に渡す前提・背景をもう少し詳しく書いてください"),
  constitutionText: z.string().min(20, "憲法テキストを入れてください"),
});

export async function createThreadAction(formData: FormData) {
  const parsed = CreateThreadInputSchema.parse({
    title: formData.get("title"),
    threadType: formData.get("threadType"),
    rawUserInput: formData.get("rawUserInput"),
    constitutionText: formData.get("constitutionText"),
  });

  const organization = await ensureDefaultOrganization();
  const thread = await createThread({
    organizationId: organization.id,
    title: parsed.title,
    threadType: parsed.threadType,
    rawUserInput: parsed.rawUserInput,
    constitutionText: parsed.constitutionText,
  });

  redirect(`/threads/${thread.id}`);
}
