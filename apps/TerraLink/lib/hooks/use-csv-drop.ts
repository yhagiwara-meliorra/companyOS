"use client";

import { useRef, useState, useEffect, useCallback } from "react";

/**
 * Hook for CSV drag-and-drop file import.
 *
 * Attaches document-level drag/drop listeners so the user can drop a CSV
 * anywhere on the page. The dropped file is injected into the hidden
 * `<input type="file">` via DataTransfer and the `<form>` is auto-submitted.
 *
 * @param opts.disabled  When true, drop is ignored (e.g. pending or no orgs).
 * @returns  formRef, fileRef to attach to <form> and <input>,
 *           isDragging flag for overlay rendering.
 */
export function useCsvDrop(opts?: { disabled?: boolean }) {
  const formRef = useRef<HTMLFormElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const dragCountRef = useRef(0);
  const disabled = opts?.disabled ?? false;

  const submitFile = useCallback(
    (file: File) => {
      if (disabled) return;
      if (!file.name.toLowerCase().endsWith(".csv")) return;
      const dt = new DataTransfer();
      dt.items.add(file);
      if (fileRef.current && formRef.current) {
        fileRef.current.files = dt.files;
        formRef.current.requestSubmit();
      }
    },
    [disabled]
  );

  useEffect(() => {
    const enter = (e: DragEvent) => {
      e.preventDefault();
      dragCountRef.current++;
      if (e.dataTransfer?.types.includes("Files")) {
        setIsDragging(true);
      }
    };

    const leave = (e: DragEvent) => {
      e.preventDefault();
      dragCountRef.current--;
      if (dragCountRef.current <= 0) {
        dragCountRef.current = 0;
        setIsDragging(false);
      }
    };

    const over = (e: DragEvent) => {
      e.preventDefault();
    };

    const drop = (e: DragEvent) => {
      e.preventDefault();
      dragCountRef.current = 0;
      setIsDragging(false);
      const file = e.dataTransfer?.files[0];
      if (file) submitFile(file);
    };

    document.addEventListener("dragenter", enter);
    document.addEventListener("dragleave", leave);
    document.addEventListener("dragover", over);
    document.addEventListener("drop", drop);

    return () => {
      document.removeEventListener("dragenter", enter);
      document.removeEventListener("dragleave", leave);
      document.removeEventListener("dragover", over);
      document.removeEventListener("drop", drop);
    };
  }, [submitFile]);

  return { formRef, fileRef, isDragging };
}
