"use client";

import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";

interface WeeklyDataPoint {
  week: string;
  [signalKey: string]: string | number;
}

interface WeeklyTrendChartProps {
  data: WeeklyDataPoint[];
  signals: { key: string; label: string; color: string }[];
  height?: number;
}

const SIGNAL_COLORS: Record<string, string> = {
  clarity: "#3b82f6",
  empathy: "#ec4899",
  constructiveness: "#10b981",
  responsiveness: "#f59e0b",
  professionalism: "#8b5cf6",
};

export function WeeklyTrendChart({
  data,
  signals,
  height = 300,
}: WeeklyTrendChartProps) {
  if (data.length === 0) {
    return (
      <div
        className="flex items-center justify-center text-sm text-slate-400"
        style={{ height }}
      >
        データがありません
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
        <XAxis
          dataKey="week"
          tick={{ fontSize: 12, fill: "#64748b" }}
          tickLine={false}
        />
        <YAxis
          domain={[0, 1]}
          tick={{ fontSize: 12, fill: "#64748b" }}
          tickLine={false}
          tickFormatter={(v: number) => v.toFixed(1)}
        />
        <Tooltip
          contentStyle={{
            backgroundColor: "#fff",
            border: "1px solid #e2e8f0",
            borderRadius: "8px",
            fontSize: "12px",
          }}
          formatter={(value: number) => [value.toFixed(2), ""]}
          labelFormatter={(label: string) => `週: ${label}`}
        />
        <Legend
          wrapperStyle={{ fontSize: "12px" }}
          iconType="circle"
          iconSize={8}
        />
        {signals.map((signal) => (
          <Line
            key={signal.key}
            type="monotone"
            dataKey={signal.key}
            name={signal.label}
            stroke={signal.color || SIGNAL_COLORS[signal.key] || "#94a3b8"}
            strokeWidth={2}
            dot={{ r: 3 }}
            activeDot={{ r: 5 }}
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}

export { SIGNAL_COLORS };
