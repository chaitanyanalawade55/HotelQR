export default function Loading() {
  return (
    <div className="min-h-screen bg-[#FFFAF3]">
      <div className="h-24 bg-[#E5E7EB] animate-pulse" />
      <div className="h-28 bg-white border-b border-[#E5E7EB] animate-pulse" />
      <div className="px-4 py-4 space-y-3">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="h-20 bg-white border border-[#E5E7EB] rounded-3xl animate-pulse" />
        ))}
      </div>
    </div>
  );
}
