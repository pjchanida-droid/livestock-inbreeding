import { useMemo, useRef, useEffect } from "react";

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
const RECT_H  = 60;
const EL_RX   = 60;
const EL_RY   = 30;
const HALF_H  = 30;
const SVG_W   = LEAVES * LEAF_W;                        // 1104
const SVG_H   = MAX_GEN * ROW_H + RECT_H + V_PAD * 2;  // 480

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
}

// ─── Layout builder ─────────────────────────────────────────────────
function buildLayout(root: PedigreeNode) {
  const nodes: PlacedNode[] = [];
  const connectors: Connector[] = [];
  // canonMap: nodeId → canonical {cx, cy}
  const canonMap = new Map<number, { cx: number; cy: number }>();
  let k = 0;

  function traverse(
    node: PedigreeNode | undefined,
    depth: number,
    slotStart: number,
    slotEnd: number,
    childCx: number | null,
    childCy: number | null
  ) {
    const cx = getCx(slotStart, slotEnd);
    const cy = getCy(depth);
    const slotMid = (slotStart + slotEnd) / 2;

    if (!node) {
      // Unknown ancestor — draw placeholder + connector down
      if (childCx !== null)
        connectors.push({ fromCx: cx, fromCy: cy, toCx: childCx, toCy: childCy! });
      nodes.push({ key: `unk-${k++}`, kind: "unknown", node: null, cx, cy });
      return;
    }

    if (node.id > 0 && canonMap.has(node.id)) {
      // Duplicate ancestor:
      // — hide this slot (no box rendered)
      // — draw a SOLID GRAY line from the canonical position to the child
      const canon = canonMap.get(node.id)!;
      nodes.push({ key: `dup-${node.id}-${k++}`, kind: "hidden", node, cx, cy });
      if (childCx !== null)
        connectors.push({ fromCx: canon.cx, fromCy: canon.cy, toCx: childCx, toCy: childCy! });
      return; // don't recurse into already-shown subtree
    }

    // First occurrence — canonical
    if (node.id > 0) canonMap.set(node.id, { cx, cy });
    if (childCx !== null)
      connectors.push({ fromCx: cx, fromCy: cy, toCx: childCx, toCy: childCy! });
    nodes.push({ key: `n-${node.id}-${k++}`, kind: "normal", node, cx, cy });

    if (depth < MAX_GEN) {
      // dam on LEFT, sire on RIGHT
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

// ─── Connector bezier path ──────────────────────────────────────────
function connPath({ fromCx, fromCy, toCx, toCy }: Connector) {
  const top  = fromCy + HALF_H;
  const bot  = toCy  - HALF_H;
  const mid  = (top + bot) / 2;
  return `M ${fromCx} ${top} C ${fromCx} ${mid} ${toCx} ${mid} ${toCx} ${bot}`;
}

// ─── Node SVG element ────────────────────────────────────────────────
function NodeSvg({ p }: { p: PlacedNode }) {
  if (p.kind === "hidden") return null;

  const { cx, cy, kind, node } = p;
  const { fill, stroke } = nodeStyle(node);
  const isFemale = node?.sex === "female";
  const F = node?.fCoefficient ?? 0;
  const hasF = F > 0;

  const nameY = hasF ? cy - 13 : cy - 7;
  const codeY = hasF ? cy + 3  : cy + 9;
  const fY    = cy + 19;

  if (kind === "unknown") {
    return (
      <g>
        <rect x={cx - RECT_W / 2} y={cy - HALF_H} width={RECT_W} height={RECT_H} rx={6}
          fill="#f9fafb" stroke="#9ca3af" strokeWidth={1.5} strokeDasharray="5 4" />
        <text x={cx} y={cy + 5} textAnchor="middle" fontSize={12} fill="#9ca3af"
          fontFamily="Sarabun, sans-serif">ไม่ทราบ</text>
      </g>
    );
  }

  const rawName = node!.name;
  const name = rawName.length > 13 ? rawName.slice(0, 12) + "…" : rawName;

  return (
    <g>
      {isFemale ? (
        <ellipse cx={cx} cy={cy} rx={EL_RX} ry={EL_RY}
          fill={fill} stroke={stroke} strokeWidth={2} />
      ) : (
        <rect x={cx - RECT_W / 2} y={cy - HALF_H} width={RECT_W} height={RECT_H} rx={6}
          fill={fill} stroke={stroke} strokeWidth={2} />
      )}

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

// ─── Main export ──────────────────────────────────────────────────────
export function PedigreeChart({ node }: { node: PedigreeNode }) {
  const { nodes, connectors } = useMemo(() => buildLayout(node), [node]);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const subjectCx = getCx(0, LEAVES);
    el.scrollLeft = subjectCx - el.clientWidth / 2;
  }, [node]);

  return (
    <div ref={containerRef} className="overflow-x-auto pb-2">
      <svg width={SVG_W} height={SVG_H} viewBox={`0 0 ${SVG_W} ${SVG_H}`}
        xmlns="http://www.w3.org/2000/svg">
        <defs>
          <marker id="arr-g" markerWidth="7" markerHeight="7" refX="7" refY="3.5" orient="auto">
            <path d="M0,0 L7,3.5 L0,7 Z" fill="#94a3b8" />
          </marker>
        </defs>

        {/* Connector lines */}
        {connectors.map((c, i) => (
          <path key={i} d={connPath(c)}
            stroke="#94a3b8" strokeWidth={1.5} fill="none"
            markerEnd="url(#arr-g)" />
        ))}

        {/* Node shapes */}
        {nodes.map((p) => <NodeSvg key={p.key} p={p} />)}
      </svg>
    </div>
  );
}
