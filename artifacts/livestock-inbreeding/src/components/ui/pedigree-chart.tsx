import { useMemo, useRef, useEffect, useCallback } from "react";
import { Button } from "./button";
import { Download } from "lucide-react";

export interface PedigreeNode {
  id: number;
  name: string;
  code: string;
  sex: string;
  fCoefficient?: number | null;
  sire?: PedigreeNode;
  dam?: PedigreeNode;
}

// ─── Layout constants ───────────────────────────────────────────────
const LEAF_W  = 138;
const LEAVES  = 8;
const MAX_GEN = 3;
const ROW_H   = 110;
const V_PAD   = 24;
const RECT_W  = 118;
const RECT_H  = 56;
const EL_RX   = 59;
const EL_RY   = 28;
const HALF_H  = 28;
const SVG_W   = LEAVES * LEAF_W;                        // 1104
const SVG_H   = MAX_GEN * ROW_H + RECT_H + V_PAD * 2;  // 444

const getCx = (s: number, e: number) => ((s + e) / 2) * LEAF_W;
const getCy = (d: number) => (MAX_GEN - d) * ROW_H + V_PAD + HALF_H;

// ─── Types ─────────────────────────────────────────────────────────
interface PlacedNode {
  key: string;
  kind: "normal" | "unknown" | "hidden";
  node: PedigreeNode | null;
  cx: number;
  cy: number;
}

interface Connector {
  fromCx: number;
  fromCy: number;
  toCx: number;
  toCy: number;
  isDuplicate?: boolean;
}

// ─── Layout builder ─────────────────────────────────────────────────
function buildLayout(root: PedigreeNode) {
  const nodes: PlacedNode[] = [];
  const connectors: Connector[] = [];
  const canonMap = new Map<number, { cx: number; cy: number }>();
  let k = 0;

  function traverse(
    node: PedigreeNode | undefined,
    depth: number,
    slotStart: number,
    slotEnd: number,
    childCx: number | null,
    childCy: number | null,
  ) {
    const cx = getCx(slotStart, slotEnd);
    const cy = getCy(depth);
    const slotMid = (slotStart + slotEnd) / 2;

    if (!node) {
      if (childCx !== null)
        connectors.push({ fromCx: cx, fromCy: cy, toCx: childCx, toCy: childCy! });
      nodes.push({ key: `unk-${k++}`, kind: "unknown", node: null, cx, cy });
      return;
    }

    if (node.id > 0 && canonMap.has(node.id)) {
      const canon = canonMap.get(node.id)!;
      nodes.push({ key: `dup-${node.id}-${k++}`, kind: "hidden", node, cx, cy });
      if (childCx !== null)
        connectors.push({ fromCx: canon.cx, fromCy: canon.cy, toCx: childCx, toCy: childCy!, isDuplicate: true });
      return;
    }

    if (node.id > 0) canonMap.set(node.id, { cx, cy });
    if (childCx !== null)
      connectors.push({ fromCx: cx, fromCy: cy, toCx: childCx, toCy: childCy! });
    nodes.push({ key: `n-${node.id}-${k++}`, kind: "normal", node, cx, cy });

    if (depth < MAX_GEN) {
      traverse(node.dam,  depth + 1, slotStart, slotMid, cx, cy);
      traverse(node.sire, depth + 1, slotMid,  slotEnd,  cx, cy);
    }
  }

  traverse(root, 0, 0, LEAVES, null, null);
  return { nodes, connectors };
}

// ─── Node SVG element ─────────────────────────────────────────────────
// Male = rectangle (blue), Female = ellipse (pink), Unknown = dashed rect
function NodeSvg({ p }: { p: PlacedNode }) {
  if (p.kind === "hidden") return null;

  const { cx, cy, kind, node } = p;
  const isFemale = node?.sex === "female";
  const F = node?.fCoefficient ?? 0;
  const hasF = F > 0;

  const nameY = hasF ? cy - 12 : cy - 6;
  const codeY = hasF ? cy + 4  : cy + 10;
  const fY    = cy + 20;

  if (kind === "unknown") {
    return (
      <g>
        <rect x={cx - RECT_W / 2} y={cy - HALF_H} width={RECT_W} height={RECT_H} rx={4}
          fill="#f9fafb" stroke="#9ca3af" strokeWidth={1.5} strokeDasharray="5 4" />
        <text x={cx} y={cy + 5} textAnchor="middle" fontSize={12} fill="#9ca3af"
          fontFamily="Sarabun, sans-serif">ไม่ทราบ</text>
      </g>
    );
  }

  const fill   = isFemale ? "#fce7f3" : "#dbeafe";
  const stroke = isFemale ? "#ec4899" : "#3b82f6";
  const rawName = node!.name;
  const name = rawName.length > 13 ? rawName.slice(0, 12) + "…" : rawName;

  return (
    <g>
      {isFemale ? (
        <ellipse cx={cx} cy={cy} rx={EL_RX} ry={EL_RY}
          fill={fill} stroke={stroke} strokeWidth={2} />
      ) : (
        <rect x={cx - RECT_W / 2} y={cy - HALF_H} width={RECT_W} height={RECT_H} rx={4}
          fill={fill} stroke={stroke} strokeWidth={2} />
      )}
      <text x={cx} y={nameY} textAnchor="middle" fontSize={11} fontWeight={700}
        fill="#111827" fontFamily="Sarabun, sans-serif">{name}</text>
      <text x={cx} y={codeY} textAnchor="middle" fontSize={10} fill="#374151"
        fontFamily="Sarabun, sans-serif">{node!.code}</text>
      {hasF && (
        <text x={cx} y={fY} textAnchor="middle" fontSize={10} fontWeight={600}
          fill="#374151" fontFamily="Sarabun, sans-serif">
          F: {(F * 100).toFixed(2)}%
        </text>
      )}
    </g>
  );
}

// ─── Legend ───────────────────────────────────────────────────────────
function Legend() {
  return (
    <g transform={`translate(8, ${SVG_H - 26})`}>
      <rect x={0} y={1} width={14} height={14} rx={2}
        fill="#dbeafe" stroke="#3b82f6" strokeWidth={1.5} />
      <text x={18} y={12} fontSize={10} fill="#374151"
        fontFamily="Sarabun, sans-serif">พ่อพันธุ์ (สี่เหลี่ยม)</text>
      <ellipse cx={115} cy={8} rx={18} ry={10}
        fill="#fce7f3" stroke="#ec4899" strokeWidth={1.5} />
      <text x={137} y={12} fontSize={10} fill="#374151"
        fontFamily="Sarabun, sans-serif">แม่พันธุ์ (วงรี)</text>
      <line x1={235} y1={8} x2={255} y2={8}
        stroke="#f87171" strokeWidth={2} strokeDasharray="6 3" />
      <text x={259} y={12} fontSize={10} fill="#374151"
        fontFamily="Sarabun, sans-serif">บรรพบุรุษซ้ำ</text>
    </g>
  );
}

// ─── Main export ──────────────────────────────────────────────────────
export function PedigreeChart({ node, animalName }: { node: PedigreeNode; animalName?: string }) {
  const { nodes, connectors } = useMemo(() => buildLayout(node), [node]);
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const subjectCx = getCx(0, LEAVES);
    el.scrollLeft = subjectCx - el.clientWidth / 2;
  }, [node]);

  const downloadJpg = useCallback(() => {
    const svgEl = svgRef.current;
    if (!svgEl) return;

    const svgClone = svgEl.cloneNode(true) as SVGSVGElement;
    const bg = document.createElementNS("http://www.w3.org/2000/svg", "rect");
    bg.setAttribute("width", String(SVG_W));
    bg.setAttribute("height", String(SVG_H));
    bg.setAttribute("fill", "white");
    svgClone.insertBefore(bg, svgClone.firstChild);

    const svgData = new XMLSerializer().serializeToString(svgClone);
    const svgBlob = new Blob([svgData], { type: "image/svg+xml;charset=utf-8" });
    const svgUrl  = URL.createObjectURL(svgBlob);

    const scale  = 2;
    const canvas = document.createElement("canvas");
    canvas.width  = SVG_W * scale;
    canvas.height = SVG_H * scale;
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "white";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.scale(scale, scale);

    const img = new Image();
    img.onload = () => {
      ctx.drawImage(img, 0, 0);
      URL.revokeObjectURL(svgUrl);
      const link = document.createElement("a");
      link.download = `${animalName ?? "pedigree"}_chart.jpg`;
      link.href = canvas.toDataURL("image/jpeg", 0.95);
      link.click();
    };
    img.onerror = () => URL.revokeObjectURL(svgUrl);
    img.src = svgUrl;
  }, [animalName]);

  return (
    <div className="space-y-2">
      <div className="flex justify-end">
        <Button variant="outline" size="sm" onClick={downloadJpg} className="gap-1.5">
          <Download className="w-4 h-4" />
          <span>ดาวน์โหลด .jpg</span>
        </Button>
      </div>

      <div ref={containerRef} className="overflow-x-auto pb-2 rounded-md border bg-white">
        <svg
          ref={svgRef}
          width={SVG_W}
          height={SVG_H}
          viewBox={`0 0 ${SVG_W} ${SVG_H}`}
          xmlns="http://www.w3.org/2000/svg"
        >
          {/* Diagonal straight lines — parent bottom-center → child top-center */}
          {connectors.map((c, i) => (
            <line
              key={i}
              x1={c.fromCx} y1={c.fromCy + HALF_H}
              x2={c.toCx}   y2={c.toCy   - HALF_H}
              stroke={c.isDuplicate ? "#f87171" : "#94a3b8"}
              strokeWidth={c.isDuplicate ? 2 : 1.5}
              strokeDasharray={c.isDuplicate ? "6 3" : undefined}
            />
          ))}

          {/* Node shapes */}
          {nodes.map((p) => <NodeSvg key={p.key} p={p} />)}

          <Legend />
        </svg>
      </div>
    </div>
  );
}
