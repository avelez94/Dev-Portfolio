"use client";

import { Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { ChartProps } from "./types";
import { formatChartValue } from "./types";

export default function ChartImpl({ kind, data, xKey, series, format = "count", height = 260 }: ChartProps) {
  const fmt = (v: unknown) => formatChartValue(Number(v), format);
  const axis = { stroke: "#5A6470", fontSize: 12 };
  const common = { data, margin: { top: 8, right: 12, bottom: 4, left: 4 } };
  const horizontal = kind === "hbar";
  return (
    <div style={{ height: horizontal ? Math.max(160, data.length * 34 + 40) : height }} aria-hidden="true">
      <ResponsiveContainer width="100%" height="100%">
        {kind === "line" ? (
          <LineChart {...common} accessibilityLayer={false}>
            <CartesianGrid stroke="#E3DED3" vertical={false} />
            <XAxis dataKey={xKey} tick={axis} tickLine={false} axisLine={{ stroke: "#E3DED3" }} />
            <YAxis tick={axis} tickFormatter={fmt} width={72} tickLine={false} axisLine={false} />
            <Tooltip formatter={(v) => fmt(v)} contentStyle={{ borderRadius: 8, borderColor: "#E3DED3", fontSize: 13 }} />
            {series.length > 1 && <Legend wrapperStyle={{ fontSize: 12 }} />}
            {series.map((s) => <Line key={s.key} type="monotone" dataKey={s.key} name={s.label} stroke={s.color} strokeWidth={2.5} dot={{ r: 2.5 }} connectNulls={false} />)}
          </LineChart>
        ) : (
          <BarChart {...common} accessibilityLayer={false} layout={horizontal ? "vertical" : "horizontal"}>
            <CartesianGrid stroke="#E3DED3" vertical={horizontal} horizontal={!horizontal} />
            {horizontal ? (
              <>
                <XAxis type="number" tick={axis} tickFormatter={fmt} tickLine={false} axisLine={false} />
                <YAxis type="category" dataKey={xKey} tick={axis} width={150} tickLine={false} axisLine={{ stroke: "#E3DED3" }} />
              </>
            ) : (
              <>
                <XAxis dataKey={xKey} tick={axis} tickLine={false} axisLine={{ stroke: "#E3DED3" }} />
                <YAxis tick={axis} tickFormatter={fmt} width={72} tickLine={false} axisLine={false} />
              </>
            )}
            <Tooltip formatter={(v) => fmt(v)} cursor={{ fill: "rgba(20,40,57,0.05)" }} contentStyle={{ borderRadius: 8, borderColor: "#E3DED3", fontSize: 13 }} />
            {series.length > 1 && <Legend wrapperStyle={{ fontSize: 12 }} />}
            {series.map((s) => <Bar key={s.key} dataKey={s.key} name={s.label} fill={s.color} stackId={kind === "stacked" ? "a" : undefined} radius={kind === "stacked" ? 0 : horizontal ? [0, 4, 4, 0] : [4, 4, 0, 0]} maxBarSize={44} />)}
          </BarChart>
        )}
      </ResponsiveContainer>
    </div>
  );
}
