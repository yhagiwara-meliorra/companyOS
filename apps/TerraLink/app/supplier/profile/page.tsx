import { redirect } from "next/navigation";
import { getSupplierContext } from "@/lib/auth/supplier-context";
import { PageHeader } from "@/components/page-header";
import { SupplierProfileForm } from "./supplier-profile-form";

export default async function SupplierProfilePage() {
  const ctx = await getSupplierContext();
  if (!ctx) redirect("/login");

  return (
    <div className="space-y-6">
      <PageHeader
        title="プロファイル"
        description="組織情報を確認・更新"
      />
      <SupplierProfileForm organization={ctx.organization} />
    </div>
  );
}
