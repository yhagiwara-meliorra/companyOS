"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

interface DropdownProps {
  trigger: ReactNode;
  children: ReactNode;
  align?: "left" | "right";
}

export function Dropdown({ trigger, children, align = "right" }: DropdownProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    function handleEscape(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="flex items-center"
      >
        {trigger}
      </button>
      {open && (
        <div
          className={`absolute top-full mt-1 z-50 min-w-[180px] rounded-lg border border-border-light bg-surface-raised py-1 shadow-lg ${
            align === "right" ? "right-0" : "left-0"
          }`}
          role="menu"
        >
          {children}
        </div>
      )}
    </div>
  );
}

interface DropdownItemProps {
  onClick?: () => void;
  href?: string;
  children: ReactNode;
  variant?: "default" | "danger";
}

export function DropdownItem({
  onClick,
  href,
  children,
  variant = "default",
}: DropdownItemProps) {
  const className = `flex w-full items-center px-3 py-2 text-sm transition-colors ${
    variant === "danger"
      ? "text-red-600 hover:bg-red-50"
      : "text-slate-700 hover:bg-slate-50"
  }`;

  if (href) {
    return (
      <a href={href} className={className} role="menuitem">
        {children}
      </a>
    );
  }

  return (
    <button type="button" onClick={onClick} className={className} role="menuitem">
      {children}
    </button>
  );
}
