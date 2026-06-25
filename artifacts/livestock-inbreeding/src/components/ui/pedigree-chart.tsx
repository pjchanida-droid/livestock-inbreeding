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

const MAX_GEN = 3;
const ROW_H = 86;
const NODE_W = 174;
const NODE_H = 66;
const COL_GAP = 56;
const COL_W = NODE_W + COL_GAP;

const TOTAL_ROWS = 2 ** MAX_GEN; // 8
const SVG_H = TOTAL_ROWS * ROW_H;
const SVG_W = (MAX_GEN + 1) * COL_W + 32;

type SlotKind = "normal" | "unknown" | "duplicate";

interface Slot {
  key: string;
  kind: SlotKind;
  node: PedigreeNode | null;
  col: number;
  yCenter: number;
}

interface Bracket {
  col: number;       // parent column; children at col+1
  parentY: number;
  topChildY: number; // sire y
  botChildY: number; // dam y
}

interface DupLink {
  fromY: number;
  fromCol: number;
  toY: number;
  toCol: number;
}

function buildLayout(root: PedigreeNode) {
  const slots: Slot[] = [];
  const brackets: Bracket[] = [];
  const dupLinks: DupLink[] = [];
  const canonY = new Map<number, { y: number; col: number }>();
  let k = 0;

  function traverse(
    node: PedigreeNode | undefined,
    col: number,
    rowStart: number,
    rowEnd: number
  ) {
    const yCenter = ((rowStart + rowEnd) / 2) * ROW_H;

    if (!node) {
      slots.push({ key: `unk-${k++}`, kind: "unknown", node: null, col, yCenter });
      return;
    }

    // Detect duplicate (same real animal, id > 0)
    if (node.id > 0 && canonY.has(node.id)) {
      const canon = canonY.get(node.id)!;
      slots.push({ key: `dup-${node.id}-${k++}`, kind: "duplicate", node, col, yCenter });
      dupLinks.push({ fromY: yCenter, fromCol: col, toY: canon.y, toCol: canon.col });
      return; // Do not recurse — subtree already shown at canonical position
    }

    if (node.id > 0) canonY.set(node.id, { y: yCenter, col });
    slots.push({ key: `n-${node.id}-${k++}`, kind: "normal", node, col, yCenter });

    if (col < MAX_GEN) {
      const rowMid = (rowStart + rowEnd) / 2;
      const topY = ((rowStart + rowMid) / 2) * ROW_H;
      const botY = ((rowMid + rowEnd) / 2) * ROW_H;
      brackets.push({ col, parentY: yCenter, topChildY: topY, botChildY: botY });
      traverse(node.sire, col + 1, rowStart, rowMid);
      traverse(node.dam, col + 1, rowMid, rowEnd);
    }
  }

  traverse(root, 0, 0, TOTAL_ROWS);
  return { slots, brackets, dupLinks };
}

function nodeX(col: number) {
  return col * COL_W;
}

// Build SVG path that routes a duplicate link around the right edge of the chart
function dupPath(link: DupLink): string {
  const fx = nodeX(link.fromCol) + NODE_W / 2;
  const tx = nodeX(link.toCol) + NODE_W + 6;
  const rightEdge = SVG_W - 6;
  const fy = link.fromY;
  const ty = link.toY;

  if (Math.abs(fy - ty) < 1) return "";

  // Route: from duplicate center → right edge → canonical node right edge
  return [
    `M ${fx} ${fy}`,
    `H ${rightEdge}`,
    `V ${ty}`,
    `H ${tx}`,
  ].join(" ");
}

function NodeBox({ slot }: { slot: Slot }) {
  const x = nodeX(slot.col);
  const y = slot.yCenter - NODE_H / 2;

  if (slot.kind === "unknown") {
    return (
      <foreignObject x={x} y={y} width={NODE_W} height={NODE_H}>
        <div
          className="w-full h-full rounded-md border-2 border-dashed border-muted-foreground/30 bg-muted/10 flex items-center justify-center"
          style={{ fontSize: 12, color: "var(--muted-foreground)" }}
        >
          ไม่ทราบ
        </div>
      </foreignObject>
    );
  }

  if (slot.kind === "duplicate") {
    // Small diamond marker at this position — actual box is at canonical
    const cx = x + NODE_W / 2;
    const cy = slot.yCenter;
    return (
      <g>
        {/* Diamond */}
        <polygon
          points={`${cx},${cy - 8} ${cx + 8},${cy} ${cx},${cy + 8} ${cx - 8},${cy}`}
          fill="hsl(var(--amber-500, 45 100% 51%))"
          stroke="hsl(var(--border))"
          strokeWidth={1}
          opacity={0.8}
          className="fill-amber-400"
        />
        <foreignObject x={x - 20} y={cy + 12} width={NODE_W + 40} height={28}>
          <div style={{ fontSize: 10, textAlign: "center", color: "var(--muted-foreground)" }}>
            ← {slot.node?.name}
          </div>
        </foreignObject>
      </g>
    );
  }

  // Normal node
  const node = slot.node!;
  const isMale = node.sex === "male";
  const bgClass = isMale
    ? "bg-blue-50/80 border-blue-200"
    : node.sex === "female"
    ? "bg-pink-50/80 border-pink-200"
    : "bg-muted/30 border-border";

  return (
    <foreignObject x={x} y={y} width={NODE_W} height={NODE_H}>
      <div
        className={`w-full h-full rounded-md border shadow-sm flex flex-col justify-center px-3 ${bgClass}`}
      >
        <div className="font-bold text-sm leading-tight truncate">{node.name}</div>
        <div className="flex items-center justify-between mt-0.5 gap-1">
          <span className="text-xs text-muted-foreground truncate">{node.code}</span>
          {(node.fCoefficient ?? 0) > 0 && (
            <Badge
              variant="outline"
              className="text-[10px] h-4 px-1.5 py-0 bg-background/70 shrink-0"
            >
              F:{((node.fCoefficient ?? 0) * 100).toFixed(1)}%
            </Badge>
          )}
        </div>
      </div>
    </foreignObject>
  );
}

export function PedigreeChart({ node }: { node: PedigreeNode }) {
  const { slots, brackets, dupLinks } = useMemo(() => buildLayout(node), [node]);

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
            id="arrow-dup"
            markerWidth="8"
            markerHeight="8"
            refX="4"
            refY="4"
            orient="auto"
          >
            <path d="M0,0 L8,4 L0,8 Z" fill="#f59e0b" />
          </marker>
        </defs>

        {/* ── Bracket connectors (normal tree edges) ── */}
        {brackets.map((b, i) => {
          const px = nodeX(b.col) + NODE_W;        // parent right edge
          const cx = nodeX(b.col + 1);             // child left edge
          const vx = px + COL_GAP / 2;            // vertical bar x

          return (
            <g key={i} stroke="#94a3b8" strokeWidth={2} fill="none" strokeLinecap="round">
              {/* Horizontal from parent to vertical bar */}
              <line x1={px} y1={b.parentY} x2={vx} y2={b.parentY} />
              {/* Vertical bar connecting sire and dam */}
              <line x1={vx} y1={b.topChildY} x2={vx} y2={b.botChildY} />
              {/* Horizontal to top child (sire) */}
              <line x1={vx} y1={b.topChildY} x2={cx} y2={b.topChildY} />
              {/* Horizontal to bottom child (dam) */}
              <line x1={vx} y1={b.botChildY} x2={cx} y2={b.botChildY} />
            </g>
          );
        })}

        {/* ── Duplicate cross-links (dashed amber, routed around right edge) ── */}
        {dupLinks.map((link, i) => (
          <path
            key={i}
            d={dupPath(link)}
            stroke="#f59e0b"
            strokeWidth={1.5}
            strokeDasharray="5,4"
            fill="none"
            markerEnd="url(#arrow-dup)"
          />
        ))}

        {/* ── Node boxes ── */}
        {slots.map((slot) => (
          <NodeBox key={slot.key} slot={slot} />
        ))}
      </svg>

      {/* Legend — only shown when there are duplicates */}
      {dupLinks.length > 0 && (
        <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground border border-dashed border-amber-300 bg-amber-50/60 rounded-md px-3 py-1.5 w-fit">
          <svg width={36} height={14}>
            <defs>
              <marker id="arrow-dup-legend" markerWidth="6" markerHeight="6" refX="3" refY="3" orient="auto">
                <path d="M0,0 L6,3 L0,6 Z" fill="#f59e0b" />
              </marker>
            </defs>
            <line x1={0} y1={7} x2={30} y2={7} stroke="#f59e0b" strokeWidth={1.5} strokeDasharray="4,3" markerEnd="url(#arrow-dup-legend)" />
          </svg>
          เส้นประสีทอง = บรรพบุรุษร่วม (ตัวเดียวกัน ไม่ซ้ำ)
        </div>
      )}
    </div>
  );
}
