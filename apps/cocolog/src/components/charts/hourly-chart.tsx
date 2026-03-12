"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

interface HourlyChartProps {
  data: { hour: number; count: number }[];
}

export function HourlyChart({ data }: HourlyChartProps) {
  const maxCount = Math.max(...data.map((d) => d.count), 1);

  return (
    <div className="h-48 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={data}
          margin={{ top: 4, right: 4, left: -20, bottom: 0 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
          <XAxis
            dataKey="hour"
            tick={{ fontSize: 11, fill: "#94a3b8" }}
            tickFormatter={(h: number) => `${h}時`}
            interval={2}
          />
          <YAxis
            tick={{ fontSize: 11, fill: "#94a3b8" }}
            allowDecimals={false}
            domain={[0, Math.ceil(maxCount * 1.2)]}
          />
          <Tooltip
            formatter={(value: number) => [`${value}件`, "メッセージ数"]}
            labelFormatter={(h: number) => `${h}:00 - ${h}:59`}
            contentStyle={{
              borderRadius: "8px",
              border: "1px solid #e2e8f0",
              fontSize: "12px",
            }}
          />
          <Bar dataKey="count" fill="#3b82f6" radius={[3, 3, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
