// Next.js Suspense fallback for the entire /dashboard route segment.
// Shown while dashboard/layout.tsx resolves the server auth + hotel query.
// AdminLoader is full-screen and self-contained — no props needed here because
// hotelName is not yet available (it's what the layout is still fetching).
import { AdminLoader } from "@/components/ui/admin-loader";

export default function DashboardLoading() {
  return <AdminLoader />;
}
