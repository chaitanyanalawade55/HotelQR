import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getHotelPayment } from "@/app/actions/hotel";
import { AdminSettingsForm } from "@/components/AdminSettingsForm";

export default async function PaymentsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: hotel } = await supabase
    .from("hotels")
    .select("id")
    .eq("owner_id", user.id)
    .single();
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
