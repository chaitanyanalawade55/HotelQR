type FoodType = "veg" | "non_veg" | "egg" | "vegan";

interface VegIndicatorProps {
  type: FoodType;
}

const config: Record<FoodType, { border: string; inner: string; text?: string }> = {
  veg: { border: "#10B981", inner: "#10B981" },
  non_veg: { border: "#EF4444", inner: "#EF4444" },
  egg: { border: "#F59E0B", inner: "#F59E0B" },
  vegan: { border: "#10B981", inner: "#10B981", text: "V" },
};

export function VegIndicator({ type }: VegIndicatorProps) {
  const { border, inner, text } = config[type];

  return (
    <span
      className="w-3.5 h-3.5 rounded-sm flex items-center justify-center flex-shrink-0"
      style={{ border: `2px solid ${border}` }}
    >
      {text ? (
        <span style={{ color: inner, fontSize: 6, fontWeight: 700, lineHeight: 1 }}>{text}</span>
      ) : (
        <span className="w-2 h-2 rounded-full" style={{ backgroundColor: inner }} />
      )}
    </span>
  );
}
