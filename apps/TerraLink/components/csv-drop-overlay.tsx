"use client";

import { Upload } from "lucide-react";

/**
 * Full-page overlay shown while the user is dragging a CSV file over the page.
 * Rendered conditionally by the import form when `isDragging` is true.
 */
export function CsvDropOverlay({ label }: { label?: string }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm pointer-events-none">
      <div className="rounded-xl border-2 border-dashed border-primary bg-card p-12 text-center shadow-lg">
        <Upload className="mx-auto h-12 w-12 text-primary" />
        <p className="mt-4 text-lg font-medium text-primary">
          {label ?? "CSV ファイルをドロップしてインポート"}
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          .csv 形式のファイルに対応しています
        </p>
      </div>
    </div>
  );
}
