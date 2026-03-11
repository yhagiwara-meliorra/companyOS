"use client";

import { Fragment } from "react";

/**
 * Simple, safe markdown renderer.
 * Handles: headings (##, ###), bullet lists (- ), bold (**text**), paragraphs.
 * No dangerouslySetInnerHTML — all output is React elements.
 */
export function SafeMarkdown({ content }: { content: string }) {
  const lines = content.split("\n");
  const elements: React.ReactNode[] = [];
  let listBuffer: string[] = [];
  let key = 0;

  function flushList() {
    if (listBuffer.length === 0) return;
    elements.push(
      <ul key={key++} className="list-disc space-y-1 pl-5">
        {listBuffer.map((item, i) => (
          <li key={i} className="text-sm leading-relaxed text-slate-700">
            {inlineParse(item)}
          </li>
        ))}
      </ul>,
    );
    listBuffer = [];
  }

  for (const line of lines) {
    const trimmed = line.trimEnd();

    // Bullet list item
    if (/^[-*]\s/.test(trimmed)) {
      listBuffer.push(trimmed.replace(/^[-*]\s+/, ""));
      continue;
    }

    // Flush pending list items before any non-list line
    flushList();

    // Empty line → spacer
    if (trimmed === "") {
      continue;
    }

    // Heading ### → h4
    if (trimmed.startsWith("### ")) {
      elements.push(
        <h4 key={key++} className="mt-4 mb-2 text-base font-semibold text-slate-800">
          {inlineParse(trimmed.slice(4))}
        </h4>,
      );
      continue;
    }

    // Heading ## → h3
    if (trimmed.startsWith("## ")) {
      elements.push(
        <h3 key={key++} className="mt-5 mb-2 text-lg font-bold text-slate-900">
          {inlineParse(trimmed.slice(3))}
        </h3>,
      );
      continue;
    }

    // Heading # → h2
    if (trimmed.startsWith("# ")) {
      elements.push(
        <h2 key={key++} className="mt-6 mb-3 text-xl font-bold text-slate-900">
          {inlineParse(trimmed.slice(2))}
        </h2>,
      );
      continue;
    }

    // Regular paragraph
    elements.push(
      <p key={key++} className="text-sm leading-relaxed text-slate-700">
        {inlineParse(trimmed)}
      </p>,
    );
  }

  // Flush remaining list
  flushList();

  return <div className="space-y-2">{elements}</div>;
}

/** Parse inline bold (**text**) safely. */
function inlineParse(text: string): React.ReactNode {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  if (parts.length === 1) return text;

  return (
    <Fragment>
      {parts.map((part, i) => {
        if (part.startsWith("**") && part.endsWith("**")) {
          return (
            <strong key={i} className="font-semibold text-slate-900">
              {part.slice(2, -2)}
            </strong>
          );
        }
        return <Fragment key={i}>{part}</Fragment>;
      })}
    </Fragment>
  );
}
