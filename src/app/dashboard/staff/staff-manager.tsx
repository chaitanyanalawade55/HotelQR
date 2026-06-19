"use client";
import { useMemo, useRef, useState } from "react";
import {
  Search, Plus, X, Pencil, Trash2, KeyRound, LayoutGrid, Power,
  Copy, Share2, UserCog, Camera, Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/Button";
import { Input, TextArea, Select } from "@/components/ui/Input";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { createClient } from "@/lib/supabase/client";
import { compressImage } from "@/lib/compressImage";
import type { Hotel, Staff, StaffTableAssignment, TableQR } from "@/types/database";

const ROLES = ["Waiter", "Cashier", "Chef", "Cleaner", "Manager", "Host"];
const SHIFTS = ["morning", "evening", "night"];

function genPassword() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
  let out = "";
  for (let i = 0; i < 8; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

interface Props {
  hotel: Pick<Hotel, "id" | "name" | "slug">;
  initialStaff: Staff[];
  tables: TableQR[];
  initialAssignments: StaffTableAssignment[];
}

export function StaffManager({ hotel, initialStaff, tables, initialAssignments }: Props) {
  const supabase = createClient();
  const [staff, setStaff] = useState<Staff[]>(initialStaff);
  const [assignments, setAssignments] = useState<StaffTableAssignment[]>(initialAssignments);
  const [query, setQuery] = useState("");

  const [formOpen, setFormOpen] = useState<false | "new" | Staff>(false);
  const [assignFor, setAssignFor] = useState<Staff | null>(null);
  const [creds, setCreds] = useState<{ staff: Staff; password: string } | null>(null);

  const loginBaseUrl = `${typeof window !== "undefined" ? window.location.origin : ""}/staff/${hotel.slug}/login`;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return staff;
    return staff.filter(
      (s) => s.full_name.toLowerCase().includes(q) || s.mobile.toLowerCase().includes(q)
    );
  }, [staff, query]);

  const tableCountFor = (staffId: string) =>
    assignments.filter((a) => a.staff_id === staffId).length;

  async function toggleActive(s: Staff) {
    const next = !s.is_active;
    const { error } = await supabase.from("staff").update({ is_active: next }).eq("id", s.id);
    if (error) return toast.error("Could not update status");
    setStaff((prev) => prev.map((x) => (x.id === s.id ? { ...x, is_active: next } : x)));
    toast.success(next ? "Staff enabled" : "Staff disabled");
  }

  async function removeStaff(s: Staff) {
    if (!confirm(`Delete ${s.full_name}? This cannot be undone.`)) return;
    const { error } = await supabase.from("staff").delete().eq("id", s.id);
    if (error) return toast.error("Could not delete");
    setStaff((prev) => prev.filter((x) => x.id !== s.id));
    setAssignments((prev) => prev.filter((a) => a.staff_id !== s.id));
    toast.success("Staff deleted");
  }

  async function resetPassword(s: Staff) {
    const password = genPassword();
    const { data, error } = await supabase.rpc("manager_set_staff_password", {
      p_staff_id: s.id,
      p_password: password,
    });
    if (error || data !== true) return toast.error("Could not reset password");
    setCreds({ staff: s, password });
  }

  return (
    <div className="px-4 md:px-8 py-6">
      <div className="flex items-center justify-between gap-3 mb-5">
        <div className="flex items-center gap-2">
          <h1 className="text-xl font-bold text-[#0F0E17]">Staff</h1>
          <Badge variant="gray">{staff.length}</Badge>
        </div>
        <Button variant="primary" size="sm" icon={<Plus size={16} />} onClick={() => setFormOpen("new")}>
          Add staff
        </Button>
      </div>

      <div className="relative mb-4">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9CA3AF]" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by name or mobile…"
          className="w-full bg-white border border-[#E5E7EB] rounded-2xl pl-9 pr-3 py-2.5 text-sm text-[#0F0E17] placeholder:text-[#9CA3AF] focus:outline-none focus:ring-2 focus:ring-[#F97316] focus:border-transparent"
        />
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={<UserCog size={24} />}
          title={staff.length === 0 ? "No staff yet" : "No matching staff"}
          description={
            staff.length === 0
              ? "Add waiters, cashiers and chefs, then share their login link."
              : "Try a different name or mobile number."
          }
        />
      ) : (
        <div className="space-y-3">
          {filtered.map((s) => (
            <div key={s.id} className="bg-white border border-[#E5E7EB] rounded-3xl p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-11 h-11 rounded-full bg-[#F3F4F6] overflow-hidden flex items-center justify-center shrink-0">
                    {s.profile_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={s.profile_url} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-[#6B7280] font-semibold">
                        {s.full_name.charAt(0).toUpperCase()}
                      </span>
                    )}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold text-[#0F0E17] truncate">{s.full_name}</p>
                      <Badge variant={s.is_active ? "green" : "gray"}>
                        {s.is_active ? "Active" : "Inactive"}
                      </Badge>
                    </div>
                    <p className="text-xs text-[#6B7280] mt-0.5 truncate">
                      {s.staff_code} · {s.role}
                      {s.shift ? ` · ${s.shift}` : ""}
                    </p>
                    <p className="text-xs text-[#9CA3AF] mt-0.5">
                      {s.mobile} · {tableCountFor(s.id)} table{tableCountFor(s.id) !== 1 ? "s" : ""}
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap gap-2 mt-3 pt-3 border-t border-[#F3F4F6]">
                <Button variant="secondary" size="sm" icon={<LayoutGrid size={14} />} onClick={() => setAssignFor(s)}>
                  Tables
                </Button>
                <Button variant="secondary" size="sm" icon={<Share2 size={14} />} onClick={() => setCreds({ staff: s, password: "" })}>
                  Share login
                </Button>
                <Button variant="secondary" size="sm" icon={<Pencil size={14} />} onClick={() => setFormOpen(s)}>
                  Edit
                </Button>
                <Button variant="secondary" size="sm" icon={<KeyRound size={14} />} onClick={() => resetPassword(s)}>
                  Reset
                </Button>
                <Button variant="secondary" size="sm" icon={<Power size={14} />} onClick={() => toggleActive(s)}>
                  {s.is_active ? "Disable" : "Enable"}
                </Button>
                <Button variant="ghost" size="sm" icon={<Trash2 size={14} />} onClick={() => removeStaff(s)}>
                  Delete
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {formOpen && (
        <StaffFormModal
          hotelId={hotel.id}
          existing={formOpen === "new" ? null : formOpen}
          onClose={() => setFormOpen(false)}
          onCreated={(created, password) => {
            setStaff((prev) => [...prev, created]);
            setFormOpen(false);
            setCreds({ staff: created, password });
          }}
          onUpdated={(updated) => {
            setStaff((prev) => prev.map((x) => (x.id === updated.id ? updated : x)));
            setFormOpen(false);
          }}
        />
      )}

      {assignFor && (
        <AssignTablesModal
          hotelId={hotel.id}
          staff={assignFor}
          tables={tables}
          assignments={assignments}
          onClose={() => setAssignFor(null)}
          onSaved={(next) => {
            setAssignments((prev) => [
              ...prev.filter((a) => a.staff_id !== assignFor.id),
              ...next,
            ]);
            setAssignFor(null);
          }}
        />
      )}

      {creds && (
        <CredentialsModal
          staff={creds.staff}
          password={creds.password}
          loginUrl={loginBaseUrl}
          hotelName={hotel.name}
          onClose={() => setCreds(null)}
        />
      )}
    </div>
  );
}

// ── Modal shell ─────────────────────────────────────────────
function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/40" />
      <div
        className="relative bg-white rounded-t-3xl md:rounded-3xl w-full md:max-w-lg p-5 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-bold text-[#0F0E17]">{title}</h2>
          <button onClick={onClose} className="text-[#9CA3AF] hover:text-[#0F0E17] p-1 min-h-0 min-w-0">
            <X size={20} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

// ── Add / Edit staff ────────────────────────────────────────
function StaffFormModal({
  hotelId,
  existing,
  onClose,
  onCreated,
  onUpdated,
}: {
  hotelId: string;
  existing: Staff | null;
  onClose: () => void;
  onCreated: (s: Staff, password: string) => void;
  onUpdated: (s: Staff) => void;
}) {
  const supabase = createClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [form, setForm] = useState({
    full_name: existing?.full_name ?? "",
    mobile: existing?.mobile ?? "",
    email: existing?.email ?? "",
    gender: existing?.gender ?? "",
    date_of_birth: existing?.date_of_birth ?? "",
    address: existing?.address ?? "",
    emergency_contact_name: existing?.emergency_contact_name ?? "",
    emergency_contact_number: existing?.emergency_contact_number ?? "",
    joining_date: existing?.joining_date ?? "",
    role: existing?.role ?? "Waiter",
    shift: existing?.shift ?? "",
    salary: existing?.salary != null ? String(existing.salary) : "",
    profile_url: existing?.profile_url ?? "",
    password: "",
  });

  const set = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }));

  async function uploadPhoto(file: File) {
    setUploading(true);
    try {
      const blob = await compressImage(file, 400, 0.8);
      const path = `${hotelId}/${Date.now()}.webp`;
      const { error } = await supabase.storage.from("staff-photos").upload(path, blob, {
        contentType: "image/webp",
        upsert: true,
      });
      if (error) throw error;
      const { data } = supabase.storage.from("staff-photos").getPublicUrl(path);
      set("profile_url", data.publicUrl);
    } catch {
      toast.error("Could not upload photo");
    } finally {
      setUploading(false);
    }
  }

  async function save() {
    if (!form.full_name.trim()) return toast.error("Full name is required");
    if (!form.mobile.trim()) return toast.error("Mobile number is required");
    if (!existing && !form.password) return toast.error("Set or generate a password");
    setSaving(true);

    const salary = form.salary ? Number(form.salary) : null;
    const common = {
      full_name: form.full_name.trim(),
      mobile: form.mobile.trim(),
      email: form.email || null,
      gender: form.gender || null,
      date_of_birth: form.date_of_birth || null,
      address: form.address || null,
      emergency_contact_name: form.emergency_contact_name || null,
      emergency_contact_number: form.emergency_contact_number || null,
      joining_date: form.joining_date || null,
      role: form.role || "Waiter",
      shift: form.shift || null,
      salary,
      profile_url: form.profile_url || null,
    };

    if (existing) {
      const { data, error } = await supabase
        .from("staff")
        .update(common)
        .eq("id", existing.id)
        .select()
        .single();
      setSaving(false);
      if (error) return toast.error(error.message || "Could not save");
      onUpdated(data as Staff);
      toast.success("Staff updated");
      return;
    }

    const { data, error } = await supabase.rpc("manager_create_staff", {
      p_hotel_id: hotelId,
      p_full_name: common.full_name,
      p_mobile: common.mobile,
      p_password: form.password,
      p_role: common.role,
      p_shift: common.shift,
      p_email: common.email,
      p_gender: common.gender,
      p_dob: common.date_of_birth,
      p_address: common.address,
      p_emergency_name: common.emergency_contact_name,
      p_emergency_number: common.emergency_contact_number,
      p_joining_date: common.joining_date,
      p_salary: common.salary,
      p_profile_url: common.profile_url,
    });
    setSaving(false);
    if (error || !data) {
      const msg = /unique|duplicate/i.test(error?.message ?? "")
        ? "A staff member with this mobile already exists"
        : error?.message || "Could not create staff";
      return toast.error(msg);
    }
    // RPC returns the public JSON; build a Staff-ish row for the list.
    const j = data as Record<string, unknown>;
    onCreated(
      {
        ...(common as object),
        id: j.id as string,
        hotel_id: hotelId,
        staff_code: j.staff_code as string,
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      } as Staff,
      form.password
    );
    toast.success("Staff created");
  }

  return (
    <Modal title={existing ? "Edit staff" : "Add staff"} onClose={onClose}>
      <div className="flex flex-col items-center mb-4">
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          className="relative w-20 h-20 rounded-full bg-[#F3F4F6] overflow-hidden flex items-center justify-center"
        >
          {form.profile_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={form.profile_url} alt="" className="w-full h-full object-cover" />
          ) : uploading ? (
            <Loader2 size={20} className="animate-spin text-[#9CA3AF]" />
          ) : (
            <Camera size={20} className="text-[#9CA3AF]" />
          )}
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) uploadPhoto(f);
          }}
        />
        <p className="text-xs text-[#9CA3AF] mt-2">Profile picture (optional)</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <Input label="Full name *" value={form.full_name} onChange={(e) => set("full_name", e.target.value)} />
        <Input label="Mobile number *" value={form.mobile} onChange={(e) => set("mobile", e.target.value)} />
        <Input label="Email" type="email" value={form.email} onChange={(e) => set("email", e.target.value)} />
        <Select label="Gender" value={form.gender} onChange={(e) => set("gender", e.target.value)}>
          <option value="">—</option>
          <option value="male">Male</option>
          <option value="female">Female</option>
          <option value="other">Other</option>
        </Select>
        <Input label="Date of birth" type="date" value={form.date_of_birth} onChange={(e) => set("date_of_birth", e.target.value)} />
        <Input label="Joining date" type="date" value={form.joining_date} onChange={(e) => set("joining_date", e.target.value)} />
        <Select label="Role" value={form.role} onChange={(e) => set("role", e.target.value)}>
          {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
        </Select>
        <Select label="Shift" value={form.shift} onChange={(e) => set("shift", e.target.value)}>
          <option value="">—</option>
          {SHIFTS.map((s) => <option key={s} value={s}>{s[0].toUpperCase() + s.slice(1)}</option>)}
        </Select>
        <Input label="Salary" type="number" value={form.salary} onChange={(e) => set("salary", e.target.value)} />
        <Input label="Emergency contact name" value={form.emergency_contact_name} onChange={(e) => set("emergency_contact_name", e.target.value)} />
        <Input label="Emergency contact number" value={form.emergency_contact_number} onChange={(e) => set("emergency_contact_number", e.target.value)} />
      </div>
      <div className="mt-3">
        <TextArea label="Address" rows={2} value={form.address} onChange={(e) => set("address", e.target.value)} />
      </div>

      {!existing && (
        <div className="mt-3">
          <label className="text-sm font-medium text-[#374151]">Password *</label>
          <div className="flex gap-2 mt-1.5">
            <input
              value={form.password}
              onChange={(e) => set("password", e.target.value)}
              placeholder="Set a password"
              className="flex-1 bg-white border border-[#E5E7EB] rounded-2xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#F97316] focus:border-transparent"
            />
            <Button variant="secondary" size="md" onClick={() => set("password", genPassword())}>
              Generate
            </Button>
          </div>
        </div>
      )}

      <div className="flex gap-2 mt-5">
        <Button variant="secondary" fullWidth onClick={onClose}>Cancel</Button>
        <Button variant="primary" fullWidth loading={saving} onClick={save}>
          {existing ? "Save changes" : "Create staff"}
        </Button>
      </div>
    </Modal>
  );
}

// ── Assign tables ───────────────────────────────────────────
function AssignTablesModal({
  hotelId,
  staff,
  tables,
  assignments,
  onClose,
  onSaved,
}: {
  hotelId: string;
  staff: Staff;
  tables: TableQR[];
  assignments: StaffTableAssignment[];
  onClose: () => void;
  onSaved: (next: StaffTableAssignment[]) => void;
}) {
  const supabase = createClient();
  const [saving, setSaving] = useState(false);
  const mine = useMemo(
    () => new Set(assignments.filter((a) => a.staff_id === staff.id).map((a) => a.table_id)),
    [assignments, staff.id]
  );
  const [selected, setSelected] = useState<Set<string>>(new Set(mine));

  // Tables already taken by ANOTHER staff member — surfaced as a conflict hint.
  const takenByOther = useMemo(() => {
    const m = new Map<string, boolean>();
    for (const a of assignments) if (a.staff_id !== staff.id) m.set(a.table_id, true);
    return m;
  }, [assignments, staff.id]);

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const allSelected = tables.length > 0 && selected.size === tables.length;
  const selectAll = () =>
    setSelected(allSelected ? new Set() : new Set(tables.map((t) => t.id)));

  async function save() {
    setSaving(true);
    const toAdd = Array.from(selected).filter((id) => !mine.has(id));
    const toRemove = Array.from(mine).filter((id) => !selected.has(id));

    if (toRemove.length) {
      await supabase
        .from("staff_table_assignments")
        .delete()
        .eq("staff_id", staff.id)
        .in("table_id", toRemove);
    }
    let inserted: StaffTableAssignment[] = [];
    if (toAdd.length) {
      const { data, error } = await supabase
        .from("staff_table_assignments")
        .insert(toAdd.map((table_id) => ({ hotel_id: hotelId, staff_id: staff.id, table_id })))
        .select();
      if (error) {
        setSaving(false);
        return toast.error("Could not save assignments");
      }
      inserted = (data as StaffTableAssignment[]) ?? [];
    }
    const kept = assignments.filter((a) => a.staff_id === staff.id && selected.has(a.table_id));
    setSaving(false);
    onSaved([...kept, ...inserted]);
    toast.success("Tables assigned");
  }

  return (
    <Modal title={`Assign tables · ${staff.full_name}`} onClose={onClose}>
      {tables.length === 0 ? (
        <EmptyState
          icon={<LayoutGrid size={24} />}
          title="No tables yet"
          description="Create table QR codes first under the QR section."
        />
      ) : (
        <>
          <button
            onClick={selectAll}
            className="text-xs font-semibold text-[#F97316] mb-3"
          >
            {allSelected ? "Clear all" : "Select all tables"}
          </button>
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
            {tables.map((t) => {
              const on = selected.has(t.id);
              const conflict = takenByOther.has(t.id);
              return (
                <button
                  key={t.id}
                  onClick={() => toggle(t.id)}
                  className={[
                    "relative rounded-2xl border px-2 py-3 text-sm font-medium transition-all",
                    on ? "bg-[#1C1C2E] text-white border-[#1C1C2E]" : "bg-white text-[#374151] border-[#E5E7EB]",
                  ].join(" ")}
                  title={conflict ? "Already assigned to another staff member" : undefined}
                >
                  {t.table_number}
                  {conflict && !on && (
                    <span className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-[#F97316]" />
                  )}
                </button>
              );
            })}
          </div>
          <p className="text-xs text-[#9CA3AF] mt-3">
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-[#F97316] mr-1 align-middle" />
            Already assigned to another staff member (multiple waiters per table is allowed).
          </p>
          <div className="flex gap-2 mt-5">
            <Button variant="secondary" fullWidth onClick={onClose}>Cancel</Button>
            <Button variant="primary" fullWidth loading={saving} onClick={save}>Save</Button>
          </div>
        </>
      )}
    </Modal>
  );
}

// ── Share credentials ───────────────────────────────────────
function CredentialsModal({
  staff,
  password,
  loginUrl,
  hotelName,
  onClose,
}: {
  staff: Staff;
  password: string;
  loginUrl: string;
  hotelName: string;
  onClose: () => void;
}) {
  const message = [
    `Hi ${staff.full_name}, here is your ${hotelName} staff login:`,
    ``,
    `Login: ${loginUrl}`,
    `Mobile: ${staff.mobile}`,
    password ? `Password: ${password}` : `Password: (the one shared earlier — use Reset to issue a new one)`,
  ].join("\n");

  async function copy() {
    await navigator.clipboard.writeText(message);
    toast.success("Copied");
  }

  return (
    <Modal title="Share login details" onClose={onClose}>
      <div className="space-y-2">
        <Row label="Login URL" value={loginUrl} />
        <Row label="Mobile" value={staff.mobile} />
        {password ? (
          <Row label="Password" value={password} />
        ) : (
          <p className="text-xs text-[#9CA3AF]">
            For security the existing password can&apos;t be shown. Use <strong>Reset</strong> to issue a new one.
          </p>
        )}
      </div>
      <div className="flex gap-2 mt-5">
        <Button variant="secondary" fullWidth icon={<Copy size={14} />} onClick={copy}>Copy</Button>
        <a
          href={`https://wa.me/?text=${encodeURIComponent(message)}`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex-1"
        >
          <Button variant="primary" fullWidth icon={<Share2 size={14} />}>WhatsApp</Button>
        </a>
      </div>
    </Modal>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-[#F8F9FA] border border-[#E5E7EB] rounded-2xl px-4 py-2.5">
      <p className="text-[10px] uppercase tracking-wider text-[#9CA3AF]">{label}</p>
      <p className="text-sm text-[#0F0E17] break-all">{value}</p>
    </div>
  );
}
