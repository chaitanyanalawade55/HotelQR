/**
 * RFC4122 v4 UUID. Uses native crypto when available, with a fallback for
 * insecure contexts (e.g. opening the app over a LAN IP, where
 * crypto.randomUUID is undefined). Generating ids client-side lets inserts be
 * fully optimistic and avoids needing to read rows back under restrictive RLS.
 */
export function uuid(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}
