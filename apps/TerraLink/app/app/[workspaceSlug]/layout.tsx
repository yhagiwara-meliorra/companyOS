import { notFound } from "next/navigation";
import { getWorkspaceContext } from "@/lib/auth/workspace-context";
import { WorkspaceShell } from "./workspace-shell";

export default async function WorkspaceLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ workspaceSlug: string }>;
}) {
  const { workspaceSlug } = await params;
  const ctx = await getWorkspaceContext(workspaceSlug);

  if (!ctx) {
    notFound();
  }

  return (
    <WorkspaceShell workspace={ctx.workspace} membership={ctx.membership}>
      {children}
    </WorkspaceShell>
  );
}
