import { redirect } from "next/navigation";
import { getAuthUser, getHotelByOwner } from "@/lib/supabase/cached-queries";
import { getHotelPayment } from "@/app/actions/hotel";
import { AdminSettingsForm } from "@/components/AdminSettingsForm";

export default async function PaymentsPage() {
  const user = await getAuthUser();
  if (!user) redirect("/login");

  const hotel = await getHotelByOwner(user.id);
  if (!hotel) redirect("/login");

  // Decrypted server-side via the ownership-checked RPC (returns null pre-migration).
  const payment = await getHotelPayment(hotel.id);

  return (
    <div className="px-4 md:px-8 py-6 max-w-xl mx-auto">
      <h1 className="text-xl font-bold text-[#0F0E17] mb-1">Payments</h1>
      <p className="text-sm text-[#6B7280] mb-5">Set the UPI that customers pay to. Stored encrypted.</p>
      <AdminSettingsForm
        hotelId={hotel.id}
        initialUpiId={payment?.upiId ?? ""}
        initialMerchantName={payment?.merchantName ?? ""}
      />
    </div>
  );
}
