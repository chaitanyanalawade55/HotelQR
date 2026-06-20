import { PublicMenuClassic } from "./public-menu-classic";
import { PublicMenuModern } from "./public-menu-modern";
import type { Hotel, HotelSettings, Category, MenuItem } from "@/types/database";

interface Props {
  hotel: Hotel;
  settings: HotelSettings | null;
  categories: Category[];
  items: MenuItem[];
  tableSlug: string;
}

export function PublicMenu(props: Props) {
  // "Modernized Premium Menu View" — the modern engine in its compact, premium
  // variant (denser cards, always-on Speciality bar, latest features).
  if (props.settings?.menu_layout === "premium") {
    return <PublicMenuModern {...props} premium />;
  }
  if (props.settings?.menu_layout === "modern") {
    return <PublicMenuModern {...props} />;
  }
  return <PublicMenuClassic {...props} />;
}
