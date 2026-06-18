// Passthrough — the gate lives in each page so the public /superadmin/login
// route is reachable. (Pages redirect non-super-admins themselves.)
export default function SuperAdminLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
