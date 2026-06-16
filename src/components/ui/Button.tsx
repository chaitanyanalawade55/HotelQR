"use client";
import { Loader2 } from "lucide-react";
import { ButtonHTMLAttributes, ReactNode } from "react";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md" | "lg";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  icon?: ReactNode;
  fullWidth?: boolean;
  children?: ReactNode;
}

const variantClasses: Record<Variant, string> = {
  primary:
    "bg-[#F97316] text-white shadow-sm hover:bg-[#EA6C0A] active:scale-[0.97] transition-all duration-150",
  secondary:
    "bg-white text-[#1C1C2E] border border-[#E5E7EB] hover:bg-[#F8F9FA] active:scale-[0.97] transition-all duration-150",
  ghost:
    "bg-transparent text-[#6B7280] hover:bg-[#F8F9FA] hover:text-[#0F0E17] transition-all duration-150",
  danger:
    "bg-[#EF4444] text-white hover:bg-[#DC2626] active:scale-[0.97] transition-all duration-150",
};

const sizeClasses: Record<Size, string> = {
  sm: "px-3 py-1.5 text-xs rounded-xl min-h-[36px]",
  md: "px-4 py-2.5 text-sm rounded-2xl min-h-[44px]",
  lg: "px-6 py-3.5 text-base rounded-2xl min-h-[52px]",
};

export function Button({
  variant = "primary",
  size = "md",
  loading = false,
  icon,
  fullWidth = false,
  children,
  disabled,
  className = "",
  ...props
}: ButtonProps) {
  const isDisabled = disabled || loading;

  return (
    <button
      disabled={isDisabled}
      className={[
        "font-medium inline-flex items-center justify-center gap-2 select-none",
        variantClasses[variant],
        sizeClasses[size],
        fullWidth ? "w-full" : "",
        isDisabled ? "opacity-50 cursor-not-allowed pointer-events-none" : "",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      {...props}
    >
      {loading ? (
        <Loader2 size={16} className="animate-spin" />
      ) : (
        <>
          {icon && icon}
          {children}
        </>
      )}
    </button>
  );
}
