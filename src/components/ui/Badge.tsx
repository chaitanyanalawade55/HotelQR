import { ReactNode } from "react";

type BadgeVariant = "orange" | "green" | "red" | "blue" | "gray" | "yellow";

interface BadgeProps {
  variant?: BadgeVariant;
  children: ReactNode;
  className?: string;
}

const variantClasses: Record<BadgeVariant, string> = {
  orange: "bg-[#FFF7ED] text-[#C2410C]",
  green: "bg-[#ECFDF5] text-[#059669]",
  red: "bg-[#FEF2F2] text-[#DC2626]",
  blue: "bg-[#EFF6FF] text-[#1D4ED8]",
  yellow: "bg-[#FEFCE8] text-[#854D0E]",
  gray: "bg-[#F3F4F6] text-[#4B5563]",
};

export function Badge({ variant = "gray", children, className = "" }: BadgeProps) {
  return (
    <span
      className={[
        "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium",
        variantClasses[variant],
        className,
      ].join(" ")}
    >
      {children}
    </span>
  );
}
