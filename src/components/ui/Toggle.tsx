"use client";

interface ToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: string;
  size?: "sm" | "default";
}

export function Toggle({ checked, onChange, label, size = "default" }: ToggleProps) {
  return (
    <div
      className="cursor-pointer flex items-center gap-2"
      onClick={() => onChange(!checked)}
      role="switch"
      aria-checked={checked}
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === " " || e.key === "Enter") {
          e.preventDefault();
          onChange(!checked);
        }
      }}
    >
      <div
        className={[
          "w-11 h-6 rounded-full transition-colors duration-200 relative flex-shrink-0",
          checked ? "bg-[#10B981]" : "bg-[#D1D5DB]",
        ].join(" ")}
      >
        <div
          className={[
            "w-5 h-5 bg-white rounded-full shadow-sm absolute top-0.5 transition-transform duration-200",
            checked ? "translate-x-5" : "translate-x-0.5",
          ].join(" ")}
        />
      </div>
      {label && (
        <span className={size === "sm" ? "text-xs text-[#374151]" : "text-sm text-[#374151]"}>
          {label}
        </span>
      )}
    </div>
  );
}
