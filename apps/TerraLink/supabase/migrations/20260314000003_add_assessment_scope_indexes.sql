-- Add indexes on assessment_scopes FK columns for join performance

CREATE INDEX IF NOT EXISTS idx_assessment_scopes_ws_org
  ON public.assessment_scopes (workspace_organization_id)
  WHERE workspace_organization_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_assessment_scopes_ws_site
  ON public.assessment_scopes (workspace_site_id)
  WHERE workspace_site_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_assessment_scopes_material
  ON public.assessment_scopes (material_id)
  WHERE material_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_assessment_scopes_relationship
  ON public.assessment_scopes (relationship_id)
  WHERE relationship_id IS NOT NULL;
