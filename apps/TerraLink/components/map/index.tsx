"use client";

import dynamic from "next/dynamic";

export const SiteMap = dynamic(
  () => import("./site-map").then((m) => m.SiteMapInner),
  {
    ssr: false,
    loading: () => (
      <div className="h-[300px] w-full animate-pulse rounded-lg bg-muted" />
    ),
  }
);

export const PlotDrawMap = dynamic(
  () => import("./plot-draw-map").then((m) => m.PlotDrawMapInner),
  {
    ssr: false,
    loading: () => (
      <div className="h-[400px] w-full animate-pulse rounded-lg bg-muted" />
    ),
  }
);

export type { DrawResult } from "./plot-draw-map";
