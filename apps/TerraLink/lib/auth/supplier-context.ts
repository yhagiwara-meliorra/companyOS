import { createClient } from "@/lib/auth/supabase-server";
import { createAdminClient } from "@/lib/db/admin";

export interface SupplierContext {
  userId: string;
  organization: {
    id: string;
    legal_name: string;
    display_name: string;
    org_type: string;
    country_code: string | null;
    website: string | null;
  };
  membership: {
    id: string;
    role: string;
  };
}

/**
 * Get the supplier context for the current user.
 * Looks up organization_members to find the user's org,
 * then returns the org + membership details.
 */
export async function getSupplierContext(): Promise<SupplierContext | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const admin = createAdminClient();

  // Find the user's org membership
  const { data: memberships } = await admin
    .from("organization_members")
    .select(
      "id, role, organization_id, organizations ( id, legal_name, display_name, org_type, country_code, website )"
    )
    .eq("user_id", user.id);

  if (!memberships || memberships.length === 0) return null;

  // Use the first org membership (for MVP)
  const membership = memberships[0];
  const org = membership.organizations as unknown as SupplierContext["organization"];

  if (!org) return null;

  return {
    userId: user.id,
    organization: org,
    membership: {
      id: membership.id,
      role: membership.role,
    },
  };
}

/**
 * Get all workspaces that have invited this organization as a supplier.
 */
export async function getSupplierWorkspaces(organizationId: string) {
  const admin = createAdminClient();

  const { data: wsOrgs } = await admin
    .from("workspace_organizations")
    .select(
      "id, relationship_role, tier, status, verification_status, workspace_id, workspaces ( id, name, slug )"
    )
    .eq("organization_id", organizationId)
    .in("relationship_role", ["supplier", "partner"])
    .eq("status", "active");

  return (wsOrgs ?? []).map((wo) => {
    const ws = wo.workspaces as unknown as {
      id: string;
      name: string;
      slug: string;
    };
    return {
      workspaceOrgId: wo.id,
      workspaceName: ws?.name ?? "Unknown",
      workspaceSlug: ws?.slug ?? "",
      relationshipRole: wo.relationship_role,
      tier: wo.tier,
      verificationStatus: wo.verification_status,
    };
  });
}
