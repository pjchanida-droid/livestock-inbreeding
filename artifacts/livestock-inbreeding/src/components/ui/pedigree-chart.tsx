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
const ROW_H   = 120;
const V_PAD   = 30;
const RECT_W  = 116;
const RECT_H  = 56;
const HALF_H  = 28;
const SVG_W   = LEAVES * LEAF_W;
const SVG_H   = MAX_GEN * ROW_H + RECT_H + V_PAD * 2;

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

// ─── Colour helpers ─────────────────────────────────────────────────
function nodeStyle(node: PedigreeNode | null) {
  if (!node) return { fill: "#f9fafb", stroke: "#9ca3af" };
  const F = node.fCoefficient ?? 0;
  if (F > 0.25)  return { fill: "#fee2e2", stroke: "#dc2626" };
  if (F > 0.125) return { fill: "#ffedd5", stroke: "#f97316" };
  if (node.sex === "female") return { fill: "#fce7f3", stroke: "#ec4899" };
  if (node.sex === "male")   return { fill: "#dbeafe", stroke: "#3b82f6" };
  return { fill: "#f3f4f6", stroke: "#6b7280" };
}

// ─── T-connector renderer ────────────────────────────────────────────
//
// Groups connectors by destination (toCx, toCy) so that when sire and dam
// both connect to the same child, instead of two overlapping lines we draw:
//   • one vertical drop from each parent to a shared horizontal rail
//   • a horizontal rail
//   • one vertical drop from the rail to the child
//
function ConnectorLines({ connectors }: { connectors: Connector[] }) {
  // Build groups keyed by destination and shared fromCy level.
  // Different fromCy (e.g. a cross-row duplicate line) stays in its own group.
  type Source = { fromCx: number; isDuplicate: boolean };
  interface Group {
    toCx: number;
    toCy: number;
    fromCy: number;
    sources: Source[];
  }

  const groupMap = new Map<string, Group>();
  for (const c of connectors) {
    // Only merge connectors that arrive at the same child AND leave from the same row
    const key = `${c.toCx},${c.toCy},${c.fromCy}`;
    if (!groupMap.has(key)) {
      groupMap.set(key, { toCx: c.toCx, toCy: c.toCy, fromCy: c.fromCy, sources: [] });
    }
    groupMap.get(key)!.sources.push({ fromCx: c.fromCx, isDuplicate: !!c.isDuplicate });
  }

  const elements: React.ReactElement[] = [];
  let idx = 0;

  for (const g of groupMap.values()) {
    const top = g.fromCy + HALF_H;  // bottom edge of parent node
    const bot = g.toCy  - HALF_H;   // top edge of child node
    const mid = (top + bot) / 2;    // midpoint rail

    if (g.sources.length === 1) {
      // Simple orthogonal L-shape — no overlap possible
      const s = g.sources[0];
      elements.push(
        <path
          key={idx++}
          d={`M ${s.fromCx} ${top} L ${s.fromCx} ${mid} L ${g.toCx} ${mid} L ${g.toCx} ${bot}`}
          stroke={s.isDuplicate ? "#f87171" : "#94a3b8"}
          strokeWidth={s.isDuplicate ? 2 : 1.5}
          strokeDasharray={s.isDuplicate ? "6 3" : undefined}
          fill="none"
        />
      );
    } else {
      // T-connector: each parent drops independently to the rail,
      // rail connects them horizontally, one drop goes to child.
      const minX = Math.min(...g.sources.map((s) => s.fromCx));
      const maxX = Math.max(...g.sources.map((s) => s.fromCx));

      // Vertical drops from each parent to rail
      for (const s of g.sources) {
        elements.push(
          <line
            key={idx++}
            x1={s.fromCx} y1={top}
            x2={s.fromCx} y2={mid}
            stroke={s.isDuplicate ? "#f87171" : "#94a3b8"}
            strokeWidth={s.isDuplicate ? 2 : 1.5}
            strokeDasharray={s.isDuplicate ? "6 3" : undefined}
          />
        );
      }

      // Horizontal rail
      elements.push(
        <line
          key={idx++}
          x1={minX} y1={mid}
          x2={maxX} y2={mid}
          stroke="#94a3b8"
          strokeWidth={1.5}
        />
      );

      // Single vertical drop from rail to child
      elements.push(
        <line
          key={idx++}
          x1={g.toCx} y1={mid}
          x2={g.toCx} y2={bot}
          stroke="#94a3b8"
          strokeWidth={1.5}
        />
      );
    }
  }

  return <>{elements}</>;
}

// ─── Node SVG element (always rectangle) ─────────────────────────────
function NodeSvg({ p }: { p: PlacedNode }) {
  if (p.kind === "hidden") return null;

  const { cx, cy, kind, node } = p;
  const { fill, stroke } = nodeStyle(node);
  const F = node?.fCoefficient ?? 0;
  const hasF = F > 0;

  const nameY = hasF ? cy - 12 : cy - 6;
  const codeY = hasF ? cy + 4  : cy + 10;
  const fY    = cy + 20;

  if (kind === "unknown") {
    return (
      <g>
        <rect
          x={cx - RECT_W / 2} y={cy - HALF_H}
          width={RECT_W} height={RECT_H} rx={4}
          fill="#f9fafb" stroke="#9ca3af" strokeWidth={1.5} strokeDasharray="5 4"
        />
        <text x={cx} y={cy + 5} textAnchor="middle" fontSize={12} fill="#9ca3af"
          fontFamily="Sarabun, sans-serif">ไม่ทราบ</text>
      </g>
    );
  }

  const rawName = node!.name;
  const name = rawName.length > 13 ? rawName.slice(0, 12) + "…" : rawName;

  return (
    <g>
      <rect
        x={cx - RECT_W / 2} y={cy - HALF_H}
        width={RECT_W} height={RECT_H} rx={4}
        fill={fill} stroke={stroke} strokeWidth={2}
      />
      <text x={cx} y={nameY} textAnchor="middle" fontSize={12} fontWeight={700}
        fill="#111827" fontFamily="Sarabun, sans-serif">{name}</text>
      <text x={cx} y={codeY} textAnchor="middle" fontSize={10} fill="#6b7280"
        fontFamily="Sarabun, sans-serif">{node!.code}</text>
      {hasF && (
        <text x={cx} y={fY} textAnchor="middle" fontSize={10} fontWeight={600}
          fill={F > 0.125 ? "#dc2626" : "#374151"} fontFamily="Sarabun, sans-serif">
          F: {(F * 100).toFixed(2)}%
        </text>
      )}
    </g>
  );
}

// ─── Legend ───────────────────────────────────────────────────────────
function Legend() {
  return (
    <g transform={`translate(8, ${SVG_H - 28})`}>
      <rect x={0}   y={0} width={14} height={14} rx={2} fill="#dbeafe" stroke="#3b82f6" strokeWidth={1.5} />
      <text x={18}  y={11} fontSize={10} fill="#374151" fontFamily="Sarabun, sans-serif">เพศผู้</text>
      <rect x={60}  y={0} width={14} height={14} rx={2} fill="#fce7f3" stroke="#ec4899" strokeWidth={1.5} />
      <text x={78}  y={11} fontSize={10} fill="#374151" fontFamily="Sarabun, sans-serif">เพศเมีย</text>
      <rect x={130} y={0} width={14} height={14} rx={2} fill="#ffedd5" stroke="#f97316" strokeWidth={1.5} />
      <text x={148} y={11} fontSize={10} fill="#374151" fontFamily="Sarabun, sans-serif">{"F > 12.5%"}</text>
      <rect x={220} y={0} width={14} height={14} rx={2} fill="#fee2e2" stroke="#dc2626" strokeWidth={1.5} />
      <text x={238} y={11} fontSize={10} fill="#374151" fontFamily="Sarabun, sans-serif">{"F > 25%"}</text>
      <line x1={310} y1={7} x2={330} y2={7} stroke="#f87171" strokeWidth={2} strokeDasharray="6 3" />
      <text x={334} y={11} fontSize={10} fill="#374151" fontFamily="Sarabun, sans-serif">บรรพบุรุษซ้ำ</text>
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
    const svgUrl = URL.createObjectURL(svgBlob);

    const scale = 2;
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
          <ConnectorLines connectors={connectors} />
          {nodes.map((p) => <NodeSvg key={p.key} p={p} />)}
          <Legend />
        </svg>
      </div>
    </div>
  );
}
