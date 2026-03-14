"use client";

import { useMemo } from "react";

type Node = { id: string; name: string; type: "from" | "to" | "both" };
type Edge = { from: string; to: string; label?: string };

const NODE_COLORS = {
  from: { fill: "#dbeafe", stroke: "#3b82f6", text: "#1e40af" },
  to: { fill: "#dcfce7", stroke: "#22c55e", text: "#166534" },
  both: { fill: "#fef3c7", stroke: "#f59e0b", text: "#92400e" },
} as const;

export function NetworkGraph({
  nodes,
  edges,
  className = "w-full",
}: {
  nodes: Node[];
  edges: Edge[];
  className?: string;
}) {
  const layout = useMemo(() => {
    // Separate nodes into columns by type
    const fromNodes = nodes.filter((n) => n.type === "from");
    const toNodes = nodes.filter((n) => n.type === "to");
    const bothNodes = nodes.filter((n) => n.type === "both");

    const maxCol = Math.max(
      fromNodes.length,
      toNodes.length,
      bothNodes.length,
      1,
    );
    const height = maxCol * 60 + 40;
    const width = 700;

    const positions: Record<string, { x: number; y: number }> = {};

    const placeColumn = (col: Node[], x: number) => {
      col.forEach((n, i) => {
        const y = (height / (col.length + 1)) * (i + 1);
        positions[n.id] = { x, y };
      });
    };

    if (bothNodes.length > 0) {
      placeColumn(fromNodes, 120);
      placeColumn(bothNodes, 350);
      placeColumn(toNodes, 580);
    } else {
      placeColumn(fromNodes, 170);
      placeColumn(toNodes, 530);
    }

    return { positions, width, height };
  }, [nodes]);

  if (nodes.length === 0) {
    return (
      <div className="flex h-40 items-center justify-center rounded-lg border border-dashed">
        <p className="text-sm text-muted-foreground">
          取引関係を追加するとネットワークグラフが表示されます
        </p>
      </div>
    );
  }

  return (
    <svg
      viewBox={`0 0 ${layout.width} ${layout.height}`}
      className={className}
      role="img"
      aria-label="サプライチェーンネットワークグラフ"
    >
      {/* Arrow marker definition */}
      <defs>
        <marker
          id="arrow"
          viewBox="0 0 10 10"
          refX="9"
          refY="5"
          markerWidth="6"
          markerHeight="6"
          orient="auto-start-reverse"
        >
          <path d="M 0 0 L 10 5 L 0 10 z" fill="#94a3b8" />
        </marker>
      </defs>

      {/* Edges */}
      {edges.map((edge, i) => {
        const from = layout.positions[edge.from];
        const to = layout.positions[edge.to];
        if (!from || !to) return null;

        // Control point for a gentle curve
        const midX = (from.x + to.x) / 2;
        const midY = (from.y + to.y) / 2 - 20;

        return (
          <g key={`edge-${i}`}>
            <path
              d={`M ${from.x + 55} ${from.y} Q ${midX} ${midY} ${to.x - 55} ${to.y}`}
              fill="none"
              stroke="#94a3b8"
              strokeWidth={1.5}
              markerEnd="url(#arrow)"
            />
            {edge.label && (
              <text
                x={midX}
                y={midY - 4}
                textAnchor="middle"
                fill="#64748b"
                fontSize={9}
              >
                {edge.label}
              </text>
            )}
          </g>
        );
      })}

      {/* Nodes */}
      {nodes.map((node) => {
        const pos = layout.positions[node.id];
        if (!pos) return null;
        const colors = NODE_COLORS[node.type];
        const displayName =
          node.name.length > 12 ? node.name.slice(0, 12) + "\u2026" : node.name;

        return (
          <g key={node.id}>
            <rect
              x={pos.x - 55}
              y={pos.y - 16}
              width={110}
              height={32}
              rx={6}
              fill={colors.fill}
              stroke={colors.stroke}
              strokeWidth={1.5}
            />
            <text
              x={pos.x}
              y={pos.y + 4}
              textAnchor="middle"
              fill={colors.text}
              fontSize={11}
              fontWeight={500}
            >
              {displayName}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
