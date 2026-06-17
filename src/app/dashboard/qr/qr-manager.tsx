"use client";
import { useState, useEffect, useRef } from "react";
import { Download, Copy, Share2, Trash2 } from "lucide-react";
import { toast } from "sonner";
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

// qrcode is loaded dynamically so it never lands in the main client bundle.
function useQRCanvas(
  canvasRef: React.RefObject<HTMLCanvasElement | null>,
  url: string,
  themeColor: string,
  size: number
) {
  useEffect(() => {
    let cancelled = false;
    if (!canvasRef.current) return;
    import("qrcode").then((QRCode) => {
      if (cancelled || !canvasRef.current) return;
      QRCode.toCanvas(canvasRef.current, url, {
        width: size,
        margin: 2,
        color: { dark: themeColor, light: "#ffffff" },
      });
    });
    return () => {
      cancelled = true;
    };
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
  const QRCode = await import("qrcode");
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
    if (error) {
      toast.error("Something went wrong");
      return;
    }
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

          {/* Share on WhatsApp */}
          <a
            href={`https://wa.me/?text=${encodeURIComponent(`View our digital menu: ${menuUrl}`)}`}
            target="_blank"
            rel="noopener"
            className="flex items-center gap-2 bg-[#25D366] text-white rounded-2xl px-4 py-2.5 text-sm font-medium w-full justify-center mt-3"
          >
            <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z" />
              <path d="M12 0C5.373 0 0 5.373 0 12c0 2.123.554 4.118 1.524 5.855L0 24l6.29-1.504A11.96 11.96 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.818a9.818 9.818 0 01-5.006-1.371l-.36-.214-3.733.892.936-3.618-.234-.372A9.818 9.818 0 1112 21.818z" />
            </svg>
            Share on WhatsApp
          </a>
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
            onKeyDown={(e) => {
              if (e.key === "Enter") addTable();
            }}
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
}: {
  table: TableQR;
  themeColor: string;
  siteUrl: string;
  onDelete: () => void;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  const url = `${siteUrl}/menu/${table.qr_slug}`;

  useQRCanvas(ref, url, themeColor, 120);

  return (
    <div className="border border-[#E5E7EB] rounded-3xl p-4">
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm font-semibold text-[#0F0E17]">Table {table.table_number}</p>
        <button onClick={onDelete} className="text-[#9CA3AF] hover:text-[#EF4444] min-h-0 min-w-0 p-1">
          <Trash2 size={16} />
        </button>
      </div>
      <div className="flex flex-col items-center">
        <canvas ref={ref} />
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
