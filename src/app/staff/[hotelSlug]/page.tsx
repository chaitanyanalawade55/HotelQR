import { StaffPortal } from "./portal";

export default async function StaffPortalPage({
  params,
}: {
  params: Promise<{ hotelSlug: string }>;
}) {
  const { hotelSlug } = await params;
  return <StaffPortal slug={hotelSlug} />;
}
