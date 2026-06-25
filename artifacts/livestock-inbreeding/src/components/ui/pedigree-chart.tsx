import { useMemo } from "react";
import { Badge } from "@/components/ui/badge";

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
const MAX_GEN = 3;          // 4 generations: 0 (subject) → 3 (great-grand)
const ROW_H   = 86;         // pixel height per row slot
const NODE_W  = 174;        // node box width
const NODE_H  = 66;         // node box height
const COL_GAP = 56;         // horizontal gap between columns (for bracket connectors)
const COL_W   = NODE_W + COL_GAP;

const TOTAL_ROWS = 2 ** MAX_GEN;   // 8
const SVG_H = TOTAL_ROWS * ROW_H;  // 688
const SVG_W = (MAX_GEN + 1) * COL_W + 16;

// ─── Data types ─────────────────────────────────────────────────────
type SlotKind = "normal" | "unknown" | "duplicate-hidden";

interface Slot {
  key: string;
  kind: SlotKind;
  node: PedigreeNode | null;
  col: number;
  yCenter: number;
}

// Normal bracket: parent at col → children at col+1
interface Bracket {
  col: number;
  parentY: number;
  topY: number;   // sire/top child y
  botY: number;   // dam/bot child y
}

// Convergent link: canonical ancestor box already drawn; draw a solid
// curved line FROM the canonical position TO the duplicate slot position
// so both connections visually come FROM the same box.
interface ConvLink {
  canonCol: number;
  canonY: number;
  dupCol: number;
  dupY: number;
  isSharedAncestor: boolean; // always true; kept for future filtering
}

// ─── Layout builder ─────────────────────────────────────────────────
function buildLayout(root: PedigreeNode) {
  const slots: Slot[] = [];
  const brackets: Bracket[] = [];
  const convLinks: ConvLink[] = [];
  // Map: animal id → { y, col } at first encounter
  const canonMap = new Map<number, { y: number; col: number }>();
  let k = 0;

  function traverse(
    node: PedigreeNode | undefined,
    col: number,
    rowStart: number,
    rowEnd: number
  ) {
    const yCenter = ((rowStart + rowEnd) / 2) * ROW_H;

    // ── Unknown ancestor ──
    if (!node) {
      slots.push({ key: `unk-${k++}`, kind: "unknown", node: null, col, yCenter });
      return;
    }

    // ── Duplicate ancestor ──
    if (node.id > 0 && canonMap.has(node.id)) {
      const canon = canonMap.get(node.id)!;
      // Mark this slot as hidden (no box rendered here)
      slots.push({ key: `dup-${node.id}-${k++}`, kind: "duplicate-hidden", node, col, yCenter });
      // Record a convergent line: FROM canonical TO this slot
      convLinks.push({
        canonCol: canon.col,
        canonY: canon.y,
        dupCol: col,
        dupY: yCenter,
        isSharedAncestor: true,
      });
      return; // Don't recurse — subtree already shown at canonical
    }

    // ── Normal (first occurrence) ──
    if (node.id > 0) canonMap.set(node.id, { y: yCenter, col });
    slots.push({ key: `n-${node.id}-${k++}`, kind: "normal", node, col, yCenter });

    if (col < MAX_GEN) {
      const rowMid = (rowStart + rowEnd) / 2;
      const topY = ((rowStart + rowMid) / 2) * ROW_H;
      const botY = ((rowMid + rowEnd) / 2) * ROW_H;
      brackets.push({ col, parentY: yCenter, topY, botY });
      traverse(node.sire, col + 1, rowStart, rowMid);
      traverse(node.dam, col + 1, rowMid, rowEnd);
    }
  }

  traverse(root, 0, 0, TOTAL_ROWS);
  return { slots, brackets, convLinks };
}

// ─── SVG path for a convergent line ─────────────────────────────────
// Creates a smooth curve from canonical box's LEFT edge to the duplicate
// slot position, staying within the bracket gap area so it doesn't
// overlap other boxes.
function convergentPath(link: ConvLink): string {
  const fromX = link.canonCol * COL_W;  // canonical left edge
  const fromY = link.canonY;
  const toX   = link.dupCol * COL_W;    // duplicate slot left edge
  const toY   = link.dupY;

  if (link.canonCol === link.dupCol) {
    // Same column: draw a ")"  shaped curve going slightly LEFT through
    // the bracket gap, so it doesn't overlap intermediate boxes.
    const ctrl = fromX - 20;
    return `M ${fromX} ${fromY} C ${ctrl} ${fromY} ${ctrl} ${toY} ${toX} ${toY}`;
  } else {
    // Different columns: arc through the space between them.
    const midX = (fromX + toX) / 2;
    return `M ${fromX} ${fromY} C ${midX} ${fromY} ${midX} ${toY} ${toX} ${toY}`;
  }
}

// ─── NodeBox component ───────────────────────────────────────────────
function NodeBox({ slot, isShared }: { slot: Slot; isShared: boolean }) {
  const x = slot.col * COL_W;
  const y = slot.yCenter - NODE_H / 2;

  if (slot.kind === "duplicate-hidden") return null; // rendered as convergent line

  if (slot.kind === "unknown") {
    return (
      <foreignObject x={x} y={y} width={NODE_W} height={NODE_H}>
        <div className="w-full h-full rounded-md border-2 border-dashed border-muted-foreground/25 bg-muted/10 flex items-center justify-center text-xs text-muted-foreground/60">
          ไม่ทราบ
        </div>
      </foreignObject>
    );
  }

  const node = slot.node!;
  const isMale   = node.sex === "male";
  const isFemale = node.sex === "female";
  const boxCls = isMale
    ? "bg-blue-50/90 border-blue-300"
    : isFemale
    ? "bg-pink-50/90 border-pink-300"
    : "bg-muted/30 border-border";

  // Shared ancestors get a subtle ring to indicate they appear more than once
  const sharedRing = isShared
    ? "ring-2 ring-amber-400 ring-offset-1"
    : "";

  return (
    <foreignObject x={x} y={y} width={NODE_W} height={NODE_H}>
      <div
        className={`w-full h-full rounded-md border shadow-sm flex flex-col justify-center px-3 ${boxCls} ${sharedRing}`}
      >
        <div className="font-bold text-sm leading-tight truncate">{node.name}</div>
        <div className="flex items-center justify-between mt-0.5 gap-1">
          <span className="text-xs text-muted-foreground truncate">{node.code}</span>
          {(node.fCoefficient ?? 0) > 0 && (
            <Badge
              variant="outline"
              className="text-[10px] h-4 px-1 py-0 bg-background/70 shrink-0"
            >
              F:{((node.fCoefficient ?? 0) * 100).toFixed(1)}%
            </Badge>
          )}
        </div>
      </div>
    </foreignObject>
  );
}

// ─── Main export ─────────────────────────────────────────────────────
export function PedigreeChart({ node }: { node: PedigreeNode }) {
  const { slots, brackets, convLinks } = useMemo(() => buildLayout(node), [node]);

  // Which canonical node IDs have convergent lines pointing TO them?
  const sharedCanonIds = useMemo(() => {
    const ids = new Set<number>();
    for (const lnk of convLinks) {
      // find the slot at (canonCol, canonY) and mark its node id
      const canon = slots.find(
        (s) => s.col === lnk.canonCol && Math.abs(s.yCenter - lnk.canonY) < 1 && s.kind === "normal"
      );
      if (canon?.node?.id) ids.add(canon.node.id);
    }
    return ids;
  }, [slots, convLinks]);

  const hasShared = convLinks.length > 0;

  return (
    <div className="overflow-x-auto pb-2">
      <svg
        width={SVG_W}
        height={SVG_H}
        viewBox={`0 0 ${SVG_W} ${SVG_H}`}
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <marker
            id="conv-arrow"
            markerWidth="7"
            markerHeight="7"
            refX="3.5"
            refY="3.5"
            orient="auto"
          >
            <circle cx="3.5" cy="3.5" r="3" fill="#64748b" />
          </marker>
        </defs>

        {/* ── Standard bracket connectors ── */}
        {brackets.map((b, i) => {
          const px = b.col * COL_W + NODE_W;          // parent right edge
          const cx = (b.col + 1) * COL_W;             // child left edge
          const vx = px + COL_GAP / 2;                // bracket vertical bar

          return (
            <g key={i} stroke="#94a3b8" strokeWidth={1.8} fill="none" strokeLinecap="round">
              <line x1={px} y1={b.parentY} x2={vx} y2={b.parentY} />
              <line x1={vx} y1={b.topY}    x2={vx} y2={b.botY} />
              <line x1={vx} y1={b.topY}    x2={cx} y2={b.topY} />
              <line x1={vx} y1={b.botY}    x2={cx} y2={b.botY} />
            </g>
          );
        })}

        {/* ── Convergent lines: solid curves from canonical to duplicate slot ── */}
        {convLinks.map((lnk, i) => (
          <g key={i}>
            <path
              d={convergentPath(lnk)}
              stroke="#475569"
              strokeWidth={2}
              fill="none"
              strokeLinecap="round"
            />
            {/* Dot at destination (duplicate slot position) */}
            <circle
              cx={lnk.dupCol * COL_W}
              cy={lnk.dupY}
              r={4}
              fill="#64748b"
            />
            {/* Dot at origin (canonical box left edge) */}
            <circle
              cx={lnk.canonCol * COL_W}
              cy={lnk.canonY}
              r={3}
              fill="#64748b"
            />
          </g>
        ))}

        {/* ── Node boxes (on top of lines) ── */}
        {slots.map((slot) => (
          <NodeBox
            key={slot.key}
            slot={slot}
            isShared={!!(slot.node?.id && sharedCanonIds.has(slot.node.id))}
          />
        ))}
      </svg>

      {/* Legend — only when shared ancestors exist */}
      {hasShared && (
        <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground border border-amber-200 bg-amber-50/60 rounded-md px-3 py-1.5 w-fit">
          <span className="inline-block w-4 h-0.5 bg-slate-500 mr-1" />
          <span className="inline-block w-3 h-3 rounded-full border-2 border-amber-400 ring-2 ring-amber-400 ring-offset-1 mr-1" />
          กล่องที่มีวงแหวนทอง = บรรพบุรุษร่วม เส้นทึบแสดงการสืบทอดจากจุดเดียว
        </div>
      )}
    </div>
  );
}
