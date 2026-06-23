import type { ElementType } from "react";

interface BadgeProps {
  label: string;
  icon?: ElementType;
  spin?: boolean;
  className?: string;
}

export function Badge({ label, icon: Icon, spin = false, className = "" }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${className}`}
    >
      {Icon && <Icon className={`w-3.5 h-3.5 ${spin ? "animate-spin" : ""}`} aria-hidden="true" />}
      {label}
    </span>
  );
}
