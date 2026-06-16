import { ReactNode } from "react";

interface EmptyStateProps {
  icon: ReactNode;
  title: string;
  description: string;
  action?: ReactNode;
}

export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center text-center py-16 px-4">
      <div className="w-16 h-16 rounded-3xl bg-[#F8F9FA] border border-[#E5E7EB] flex items-center justify-center text-[#9CA3AF] mb-4">
        {icon}
      </div>
      <p className="text-base font-semibold text-[#0F0E17] mb-1">{title}</p>
      <p className="text-sm text-[#6B7280] max-w-xs mb-5">{description}</p>
      {action && action}
    </div>
  );
}
