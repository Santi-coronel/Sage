import type { ElementType, ReactNode } from "react";

interface EmptyStateProps {
  icon: ElementType;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}

export function EmptyState({ icon: Icon, title, description, action, className = "" }: EmptyStateProps) {
  return (
    <div className={`flex flex-col items-center justify-center text-center ${className}`}>
      <Icon className="w-12 h-12 text-gray-300 mb-4" aria-hidden="true" />
      <p className="text-gray-700 font-medium">{title}</p>
      {description && <p className="text-gray-500 text-sm mt-1">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
