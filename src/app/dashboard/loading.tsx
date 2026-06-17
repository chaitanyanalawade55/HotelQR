export default function Loading() {
  return (
    <div className="px-4 py-6 space-y-4 animate-pulse">
      <div className="h-6 w-40 bg-[#E5E7EB] rounded-2xl" />
      <div className="grid grid-cols-2 gap-3">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-24 bg-[#E5E7EB] rounded-3xl" />
        ))}
      </div>
      <div className="h-32 bg-[#E5E7EB] rounded-3xl" />
    </div>
  );
}
