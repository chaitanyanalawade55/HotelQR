"use client";
import { InputHTMLAttributes, ReactNode, TextareaHTMLAttributes, SelectHTMLAttributes } from "react";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
  icon?: ReactNode;
}

export function Input({ label, error, hint, icon, className = "", ...props }: InputProps) {
  return (
    <div className="w-full flex flex-col gap-1.5">
      {label && (
        <label className="text-sm font-medium text-[#374151]">{label}</label>
      )}
      <div className="relative">
        {icon && (
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9CA3AF] size-4 flex items-center justify-center">
            {icon}
          </span>
        )}
        <input
          className={[
            "w-full bg-white border rounded-2xl px-4 py-3 text-sm text-[#0F0E17] placeholder:text-[#9CA3AF] focus:outline-none focus:ring-2 focus:border-transparent transition-all duration-150",
            icon ? "pl-10" : "",
            error
              ? "border-[#EF4444] bg-[#FEF2F2] focus:ring-[#EF4444]"
              : "border-[#E5E7EB] focus:ring-[#F97316]",
            className,
          ]
            .filter(Boolean)
            .join(" ")}
          {...props}
        />
      </div>
      {error && <p className="text-xs text-[#EF4444] mt-1">{error}</p>}
      {hint && !error && <p className="text-xs text-[#6B7280] mt-1">{hint}</p>}
    </div>
  );
}

interface TextAreaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  hint?: string;
}

export function TextArea({ label, error, hint, className = "", ...props }: TextAreaProps) {
  return (
    <div className="w-full flex flex-col gap-1.5">
      {label && (
        <label className="text-sm font-medium text-[#374151]">{label}</label>
      )}
      <textarea
        className={[
          "w-full bg-white border rounded-2xl px-4 py-3 text-sm text-[#0F0E17] placeholder:text-[#9CA3AF] focus:outline-none focus:ring-2 focus:border-transparent transition-all duration-150 resize-none",
          error
            ? "border-[#EF4444] bg-[#FEF2F2] focus:ring-[#EF4444]"
            : "border-[#E5E7EB] focus:ring-[#F97316]",
          className,
        ]
          .filter(Boolean)
          .join(" ")}
        {...props}
      />
      {error && <p className="text-xs text-[#EF4444] mt-1">{error}</p>}
      {hint && !error && <p className="text-xs text-[#6B7280] mt-1">{hint}</p>}
    </div>
  );
}

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  hint?: string;
}

export function Select({ label, error, hint, className = "", children, ...props }: SelectProps) {
  return (
    <div className="w-full flex flex-col gap-1.5">
      {label && (
        <label className="text-sm font-medium text-[#374151]">{label}</label>
      )}
      <select
        className={[
          "w-full bg-white border rounded-2xl px-4 py-3 text-sm text-[#0F0E17] focus:outline-none focus:ring-2 focus:border-transparent transition-all duration-150",
          error
            ? "border-[#EF4444] bg-[#FEF2F2] focus:ring-[#EF4444]"
            : "border-[#E5E7EB] focus:ring-[#F97316]",
          className,
        ]
          .filter(Boolean)
          .join(" ")}
        {...props}
      >
        {children}
      </select>
      {error && <p className="text-xs text-[#EF4444] mt-1">{error}</p>}
      {hint && !error && <p className="text-xs text-[#6B7280] mt-1">{hint}</p>}
    </div>
  );
}
