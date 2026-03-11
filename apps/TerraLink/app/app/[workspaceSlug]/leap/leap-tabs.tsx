"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MapPin, FlaskConical, ShieldAlert, FileText } from "lucide-react";
import { LocateTab } from "./locate-tab";
import { EvaluateTab } from "./evaluate-tab";
import { AssessTab } from "./assess-tab";
import { PrepareTab } from "./prepare-tab";
import { AssessmentHeader } from "./assessment-header";
import type {
  AssessmentRow,
  ScopeRow,
  DependencyRow,
  ImpactRow,
  RiskRow,
  RiskScoreRow,
  IntersectionRow,
  DisclosureRow,
  MonitoringRuleRow,
  NatureTopicRow,
} from "./page";

type Props = {
  workspaceSlug: string;
  assessments: AssessmentRow[];
  activeAssessment: AssessmentRow | undefined;
  scopes: ScopeRow[];
  dependencies: DependencyRow[];
  impacts: ImpactRow[];
  risks: RiskRow[];
  riskScores: RiskScoreRow[];
  disclosures: DisclosureRow[];
  monitoringRules: MonitoringRuleRow[];
  intersections: IntersectionRow[];
  wsSiteNameMap: Record<string, string>;
  natureTopics: NatureTopicRow[];
  orgNameMap: Record<string, string>;
  wsOrgs: { id: string; name: string }[];
  wsSiteOptions: { id: string; name: string }[];
};

const TABS = [
  { value: "locate", label: "特定 (Locate)", icon: MapPin },
  { value: "evaluate", label: "評価 (Evaluate)", icon: FlaskConical },
  { value: "assess", label: "査定 (Assess)", icon: ShieldAlert },
  { value: "prepare", label: "準備 (Prepare)", icon: FileText },
] as const;

export function LeapTabs({
  workspaceSlug,
  assessments,
  activeAssessment,
  scopes,
  dependencies,
  impacts,
  risks,
  riskScores,
  disclosures,
  monitoringRules,
  intersections,
  wsSiteNameMap,
  natureTopics,
  orgNameMap,
  wsOrgs,
  wsSiteOptions,
}: Props) {
  return (
    <div className="space-y-6">
      <AssessmentHeader
        workspaceSlug={workspaceSlug}
        assessments={assessments}
        activeAssessment={activeAssessment}
      />

      {activeAssessment ? (
        <Tabs defaultValue="locate" className="space-y-6">
          <TabsList className="grid w-full grid-cols-4">
            {TABS.map((tab) => {
              const Icon = tab.icon;
              return (
                <TabsTrigger
                  key={tab.value}
                  value={tab.value}
                  className="flex items-center gap-2"
                >
                  <Icon className="h-4 w-4" />
                  {tab.label}
                </TabsTrigger>
              );
            })}
          </TabsList>

          <TabsContent value="locate" className="space-y-4">
            <LocateTab
              workspaceSlug={workspaceSlug}
              assessmentId={activeAssessment.id}
              scopes={scopes}
              intersections={intersections}
              wsSiteNameMap={wsSiteNameMap}
              orgNameMap={orgNameMap}
              wsOrgs={wsOrgs}
              wsSiteOptions={wsSiteOptions}
            />
          </TabsContent>

          <TabsContent value="evaluate" className="space-y-4">
            <EvaluateTab
              workspaceSlug={workspaceSlug}
              scopes={scopes}
              dependencies={dependencies}
              impacts={impacts}
              natureTopics={natureTopics}
              wsSiteNameMap={wsSiteNameMap}
              orgNameMap={orgNameMap}
            />
          </TabsContent>

          <TabsContent value="assess" className="space-y-4">
            <AssessTab
              workspaceSlug={workspaceSlug}
              scopes={scopes}
              risks={risks}
              riskScores={riskScores}
              wsSiteNameMap={wsSiteNameMap}
              orgNameMap={orgNameMap}
            />
          </TabsContent>

          <TabsContent value="prepare" className="space-y-4">
            <PrepareTab
              workspaceSlug={workspaceSlug}
              assessmentId={activeAssessment.id}
              disclosures={disclosures}
              monitoringRules={monitoringRules}
            />
          </TabsContent>
        </Tabs>
      ) : (
        <div className="rounded-lg border-2 border-dashed p-12 text-center">
          <p className="text-muted-foreground">
            アセスメントを作成してLEAPワークフローを開始してください。
          </p>
        </div>
      )}
    </div>
  );
}
