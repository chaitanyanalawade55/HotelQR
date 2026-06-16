"use client";
import { useState, useEffect, useRef } from "react";
import { Download, Copy, Share2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import QRCode from "qrcode";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { createClient } from "@/lib/supabase/client";
import type { Hotel, HotelSettings, TableQR } from "@/types/database";

interface Props {
  hotel: Hotel;
  settings: HotelSettings | null;
  initialTables: TableQR[];
}

function useQRCanvas(
  canvasRef: React.RefObject<HTMLCanvasElement | null>,
  url: string,
  themeColor: string,
  size: number
) {
  useEffect(() => {
    if (!canvasRef.current) return;
    QRCode.toCanvas(canvasRef.current, url, {
      width: size,
      margin: 2,
      color: { dark: themeColor, light: "#ffffff" },
    });
  }, [url, themeColor, size, canvasRef]);
}

function downloadCanvas(canvas: HTMLCanvasElement | null, filename: string) {
  if (!canvas) return;
  const link = document.createElement("a");
  link.download = filename;
  link.href = canvas.toDataURL("image/png");
  link.click();
}

async function downloadSVG(url: string, filename: string, themeColor: string) {
  const svgString = await QRCode.toString(url, { type: "svg", color: { dark: themeColor, light: "#ffffff" } });
  const blob = new Blob([svgString], { type: "image/svg+xml" });
  const link = document.createElement("a");
  link.download = filename;
  link.href = URL.createObjectURL(blob);
  link.click();
}

export function QRManager({ hotel, settings, initialTables }: Props) {
  const [tables, setTables] = useState<TableQR[]>(initialTables);
  const [tableInput, setTableInput] = useState("");
  const [addingTable, setAddingTable] = useState(false);
  const mainCanvasRef = useRef<HTMLCanvasElement>(null);
  const tableCanvasRefs = useRef<Record<string, HTMLCanvasElement | null>>({});
  const supabase = createClient();

  const themeColor = settings?.theme_color ?? "#F97316";
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  const menuUrl = `${siteUrl}/menu/${hotel.slug}`;

  useQRCanvas(mainCanvasRef, menuUrl, themeColor, 200);

  async function handleCopy() {
    await navigator.clipboard.writeText(menuUrl);
    toast.success("Link copied to clipboard");
  }

  async function handleShare() {
    if (navigator.share) {
      await navigator.share({ title: hotel.name, url: menuUrl });
    } else {
      await navigator.clipboard.writeText(menuUrl);
      toast.success("Link copied to clipboard");
    }
  }

  async function addTable() {
    if (!tableInput.trim()) return;
    setAddingTable(true);
    const rand = Math.floor(1000 + Math.random() * 9000);
    const qr_slug = `${hotel.slug}-t${tableInput.trim()}-${rand}`;
    const { data, error } = await supabase
      .from("tables")
      .insert({ hotel_id: hotel.id, table_number: tableInput.trim(), qr_slug })
      .select()
      .single();
    setAddingTable(false);
    if (error) { toast.error("Something went wrong"); return; }
    setTables((prev) => [...prev, data as TableQR]);
    setTableInput("");
  }

  async function deleteTable(id: string) {
    await supabase.from("tables").delete().eq("id", id);
    setTables((prev) => prev.filter((t) => t.id !== id));
  }

  return (
    <div className="px-4 md:px-8 py-6 max-w-xl mx-auto space-y-4">
      <h1 className="text-xl font-bold text-[#0F0E17] mb-5">QR Code</h1>

      {/* Main QR */}
      <Card padding="lg">
        <p className="text-sm font-semibold text-[#0F0E17] mb-1">Main menu QR</p>
        <p className="text-xs text-[#6B7280] mb-4">Place at entrance, tables, or share the link</p>
        <div className="flex flex-col items-center">
          <div className="border border-[#E5E7EB] rounded-3xl p-3 bg-white inline-block">
            <canvas ref={mainCanvasRef} />
          </div>
          <p className="text-xs text-[#9CA3AF] text-center mt-2 break-all">{menuUrl}</p>

          <div className="flex gap-2 mt-4">
            <Button
              variant="secondary"
              size="sm"
              icon={<Download size={14} />}
              onClick={() => downloadCanvas(mainCanvasRef.current, `${hotel.slug}-menu-qr.png`)}
            >
              PNG
            </Button>
            <Button
              variant="secondary"
              size="sm"
              icon={<Download size={14} />}
              onClick={() => downloadSVG(menuUrl, `${hotel.slug}-menu-qr.svg`, themeColor)}
            >
              SVG
            </Button>
          </div>
          <div className="flex gap-2 mt-2">
            <Button variant="secondary" size="sm" icon={<Copy size={14} />} onClick={handleCopy}>
              Copy link
            </Button>
            <Button variant="secondary" size="sm" icon={<Share2 size={14} />} onClick={handleShare}>
              Share
            </Button>
          </div>
        </div>
      </Card>

      {/* Table QRs */}
      <Card padding="lg">
        <p className="text-sm font-semibold text-[#0F0E17] mb-1">Table QR Codes</p>
        <p className="text-xs text-[#6B7280] mb-4">One QR per table for tracking (optional)</p>

        <div className="flex gap-2 mb-4">
          <Input
            value={tableInput}
            onChange={(e) => setTableInput(e.target.value)}
            placeholder="Table number e.g. T1, 5, VIP"
            onKeyDown={(e) => { if (e.key === "Enter") addTable(); }}
          />
          <Button variant="primary" size="sm" loading={addingTable} onClick={addTable}>
            Add
          </Button>
        </div>

        {tables.length === 0 ? (
          <p className="text-sm text-[#9CA3AF] text-center py-6">No table codes yet</p>
        ) : (
          <div className="space-y-4">
            {tables.map((table) => (
              <TableQRCard
                key={table.id}
                table={table}
                themeColor={themeColor}
                siteUrl={siteUrl}
                onDelete={() => deleteTable(table.id)}
                canvasRef={(el) => { tableCanvasRefs.current[table.id] = el; }}
              />
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

function TableQRCard({
  table,
  themeColor,
  siteUrl,
  onDelete,
  canvasRef,
}: {
  table: TableQR;
  themeColor: string;
  siteUrl: string;
  onDelete: () => void;
  canvasRef: (el: HTMLCanvasElement | null) => void;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  const url = `${siteUrl}/menu/${table.qr_slug}`;

  useEffect(() => {
    if (!ref.current) return;
    QRCode.toCanvas(ref.current, url, {
      width: 120,
      margin: 2,
      color: { dark: themeColor, light: "#ffffff" },
    });
  }, [url, themeColor]);

  return (
    <div className="border border-[#E5E7EB] rounded-3xl p-4">
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm font-semibold text-[#0F0E17]">Table {table.table_number}</p>
        <button onClick={onDelete} className="text-[#9CA3AF] hover:text-[#EF4444] min-h-0 min-w-0 p-1">
          <Trash2 size={16} />
        </button>
      </div>
      <div className="flex flex-col items-center">
        <canvas ref={(el) => { ref.current = el; canvasRef(el); }} />
        <div className="flex gap-2 mt-3">
          <Button
            variant="secondary"
            size="sm"
            icon={<Download size={12} />}
            onClick={() => downloadCanvas(ref.current, `table-${table.table_number}-qr.png`)}
          >
            PNG
          </Button>
          <Button
            variant="secondary"
            size="sm"
            icon={<Download size={12} />}
            onClick={() => downloadSVG(url, `table-${table.table_number}-qr.svg`, themeColor)}
          >
            SVG
          </Button>
        </div>
      </div>
    </div>
  );
}
