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
const LEAF_W   = 138;      // px per leaf slot
const LEAVES   = 8;        // 2^3 leaf slots
const MAX_GEN  = 3;        // generations beyond subject
const ROW_H    = 120;      // vertical row height
const V_PAD    = 30;       // top/bottom padding
const RECT_W   = 116;      // male / unknown node width
const RECT_H   = 60;       // male / unknown node height
const EL_RX    = 60;       // female ellipse x-radius
const EL_RY    = 30;       // female ellipse y-radius
const HALF_H   = 30;       // uniform half-height for connection points
const SVG_W    = LEAVES * LEAF_W;                    // 1104
const SVG_H    = MAX_GEN * ROW_H + RECT_H + V_PAD * 2; // 3×120+60+60 = 480

// ─── Position helpers ───────────────────────────────────────────────
// slotStart/slotEnd are 0-based leaf indices
const getCx = (s: number, e: number) => ((s + e) / 2) * LEAF_W;
// depth=0 is subject (bottom), depth=MAX_GEN is top
const getCy = (d: number) => (MAX_GEN - d) * ROW_H + V_PAD + HALF_H;

// ─── Data types ─────────────────────────────────────────────────────
interface PlacedNode {
  key: string;
  kind: "normal" | "unknown" | "hidden";
  node: PedigreeNode | null;
  cx: number;
  cy: number;
  isSharedCanon: boolean;
}

interface Connector { fromCx: number; fromCy: number; toCx: number; toCy: number }
interface SharedCurve { canonCx: number; canonCy: number; dupCx: number; dupCy: number }

// ─── Layout builder ─────────────────────────────────────────────────
function buildLayout(root: PedigreeNode) {
  const nodes: PlacedNode[] = [];
  const connectors: Connector[] = [];
  const sharedCurves: SharedCurve[] = [];
  const canonMap = new Map<number, { cx: number; cy: number }>();
  const sharedCanonIds = new Set<number>();
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

    // Unknown ancestor
    if (!node) {
      if (childCx !== null)
        connectors.push({ fromCx: cx, fromCy: cy, toCx: childCx, toCy: childCy! });
      nodes.push({ key: `unk-${k++}`, kind: "unknown", node: null, cx, cy, isSharedCanon: false });
      return;
    }

    // Duplicate (shared ancestor) — hide this slot, record a shared-curve
    if (node.id > 0 && canonMap.has(node.id)) {
      const canon = canonMap.get(node.id)!;
      nodes.push({ key: `dup-${node.id}-${k++}`, kind: "hidden", node, cx, cy, isSharedCanon: false });
      sharedCurves.push({ canonCx: canon.cx, canonCy: canon.cy, dupCx: cx, dupCy: cy });
      sharedCanonIds.add(node.id);
      return; // don't recurse into duplicate subtrees
    }

    // First occurrence
    if (node.id > 0) canonMap.set(node.id, { cx, cy });
    if (childCx !== null)
      connectors.push({ fromCx: cx, fromCy: cy, toCx: childCx, toCy: childCy! });
    nodes.push({ key: `n-${node.id}-${k++}`, kind: "normal", node, cx, cy, isSharedCanon: false });

    if (depth < MAX_GEN) {
      // dam on LEFT, sire on RIGHT (matches typical livestock pedigree convention)
      traverse(node.dam,  depth + 1, slotStart, slotMid, cx, cy);
      traverse(node.sire, depth + 1, slotMid,  slotEnd,  cx, cy);
    }
  }

  traverse(root, 0, 0, LEAVES, null, null);

  // Tag canonical nodes that appear as shared ancestors
  for (const n of nodes) {
    if (n.node?.id && sharedCanonIds.has(n.node.id)) n.isSharedCanon = true;
  }

  return { nodes, connectors, sharedCurves };
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

// ─── SVG path helpers ───────────────────────────────────────────────
function connPath({ fromCx, fromCy, toCx, toCy }: Connector) {
  const top    = fromCy + HALF_H;
  const bottom = toCy  - HALF_H;
  const mid    = (top + bottom) / 2;
  return `M ${fromCx} ${top} C ${fromCx} ${mid} ${toCx} ${mid} ${toCx} ${bottom}`;
}

function sharedPath({ canonCx, canonCy, dupCx, dupCy }: SharedCurve) {
  const sameRow = Math.abs(canonCy - dupCy) < 6;
  if (sameRow) {
    // Arc below the row
    const sy   = canonCy + HALF_H + 4;
    const ey   = dupCy   + HALF_H + 4;
    const midX = (canonCx + dupCx) / 2;
    const ctrlY = Math.max(sy, ey) + 54;
    return `M ${canonCx} ${sy} Q ${midX} ${ctrlY} ${dupCx} ${ey}`;
  }
  // Different depths — arc to the left or right
  const goLeft = canonCx > dupCx;
  const ctrlX  = goLeft
    ? Math.min(canonCx, dupCx) - 70
    : Math.max(canonCx, dupCx) + 70;
  const midY  = (canonCy + dupCy) / 2;
  const sx    = goLeft ? canonCx - HALF_H - 4 : canonCx + HALF_H + 4;
  const ex    = goLeft ? dupCx   + HALF_H + 4 : dupCx   - HALF_H - 4;
  return `M ${sx} ${canonCy} Q ${ctrlX} ${midY} ${ex} ${dupCy}`;
}

// ─── Node renderer ──────────────────────────────────────────────────
function NodeSvg({ p }: { p: PlacedNode }) {
  if (p.kind === "hidden") return null;

  const { cx, cy, kind, node, isSharedCanon } = p;
  const { fill, stroke } = nodeStyle(node);
  const dash = isSharedCanon ? "7 4" : undefined;
  const isFemale = node?.sex === "female";
  const F = node?.fCoefficient ?? 0;
  const hasF = F > 0;

  // Text vertical positions (3 lines if F>0, 2 lines otherwise)
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
  const code = node!.code;

  return (
    <g>
      {isFemale ? (
        <ellipse cx={cx} cy={cy} rx={EL_RX} ry={EL_RY}
          fill={fill} stroke={stroke} strokeWidth={2} strokeDasharray={dash} />
      ) : (
        <rect x={cx - RECT_W / 2} y={cy - HALF_H} width={RECT_W} height={RECT_H} rx={6}
          fill={fill} stroke={stroke} strokeWidth={2} strokeDasharray={dash} />
      )}

      <text x={cx} y={nameY} textAnchor="middle" fontSize={12} fontWeight={700}
        fill="#111827" fontFamily="Sarabun, sans-serif">{name}</text>

      <text x={cx} y={codeY} textAnchor="middle" fontSize={10} fill="#6b7280"
        fontFamily="Sarabun, sans-serif">{code}</text>

      {hasF && (
        <text x={cx} y={fY} textAnchor="middle" fontSize={10} fontWeight={600}
          fill={F > 0.125 ? "#dc2626" : "#374151"} fontFamily="Sarabun, sans-serif">
          F: {(F * 100).toFixed(2)}%
        </text>
      )}
    </g>
  );
}

// ─── Main export ─────────────────────────────────────────────────────
export function PedigreeChart({ node }: { node: PedigreeNode }) {
  const { nodes, connectors, sharedCurves } = useMemo(() => buildLayout(node), [node]);
  const hasShared = sharedCurves.length > 0;
  const containerRef = useRef<HTMLDivElement>(null);

  // Auto-scroll so the subject node (always at center of SVG) is centered in viewport
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const subjectCx = getCx(0, LEAVES); // = LEAVES/2 * LEAF_W = center
    el.scrollLeft = subjectCx - el.clientWidth / 2;
  }, [node]);

  return (
    <div ref={containerRef} className="overflow-x-auto pb-2">
      <svg width={SVG_W} height={SVG_H} viewBox={`0 0 ${SVG_W} ${SVG_H}`}
        xmlns="http://www.w3.org/2000/svg">
        <defs>
          {/* Gray arrowhead for normal connectors */}
          <marker id="arr-g" markerWidth="7" markerHeight="7" refX="7" refY="3.5" orient="auto">
            <path d="M0,0 L7,3.5 L0,7 Z" fill="#94a3b8" />
          </marker>
          {/* Red arrowhead for shared-ancestor curves */}
          <marker id="arr-r" markerWidth="7" markerHeight="7" refX="7" refY="3.5" orient="auto">
            <path d="M0,0 L7,3.5 L0,7 Z" fill="#ef4444" />
          </marker>
        </defs>

        {/* ── Connector lines (ancestor → descendant) ── */}
        {connectors.map((c, i) => (
          <path key={i} d={connPath(c)}
            stroke="#94a3b8" strokeWidth={1.5} fill="none"
            markerEnd="url(#arr-g)" />
        ))}

        {/* ── Shared-ancestor dashed curves ── */}
        {sharedCurves.map((s, i) => (
          <path key={i} d={sharedPath(s)}
            stroke="#ef4444" strokeWidth={2} strokeDasharray="7 5"
            fill="none" markerEnd="url(#arr-r)" />
        ))}

        {/* ── Node shapes (rendered on top of lines) ── */}
        {nodes.map((p) => <NodeSvg key={p.key} p={p} />)}
      </svg>

      {hasShared && (
        <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground
          border border-red-200 bg-red-50/60 rounded-md px-3 py-1.5 w-fit">
          <svg width="22" height="10" className="shrink-0">
            <line x1="0" y1="5" x2="22" y2="5"
              stroke="#ef4444" strokeWidth={2} strokeDasharray="5 3" />
          </svg>
          เส้นประแดง = บรรพบุรุษร่วม (ขอบประ = ตัวที่ปรากฏในสายสัมพันธ์ทั้งสองด้าน)
        </div>
      )}
    </div>
  );
}
