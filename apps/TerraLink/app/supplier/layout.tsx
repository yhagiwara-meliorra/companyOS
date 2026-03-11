import { redirect } from "next/navigation";
import { getSupplierContext } from "@/lib/auth/supplier-context";
import { SupplierShell } from "./supplier-shell";

export default async function SupplierLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const ctx = await getSupplierContext();

  if (!ctx) {
    redirect("/login");
  }

  return (
    <SupplierShell organization={ctx.organization} membership={ctx.membership}>
      {children}
    </SupplierShell>
  );
}
