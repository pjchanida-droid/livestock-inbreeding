import { useRef, useCallback } from "react";
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
const BOX_W  = 140;
const BOX_H  = 60;
const HALF_H = BOX_H / 2;
const GAP_H  = 100;  // vertical gap between rows
const PAD    = 20;

// 3 boxes: [dam | subject | sire]  each BOX_W wide + gaps
const COL_DAM  = PAD;
const COL_SUB  = PAD + BOX_W + 60;
const COL_SIRE = PAD + (BOX_W + 60) * 2;

const ROW_PARENT  = PAD;
const ROW_SUBJECT = PAD + BOX_H + GAP_H;

const SVG_W = COL_SIRE + BOX_W + PAD;
const SVG_H = ROW_SUBJECT + BOX_H + PAD;

// ─── Colour helpers ─────────────────────────────────────────────────
function nodeColors(sex: string) {
  if (sex === "male")   return { fill: "#dbeafe", stroke: "#3b82f6" };
  if (sex === "female") return { fill: "#fce7f3", stroke: "#ec4899" };
  return { fill: "#f3f4f6", stroke: "#9ca3af" };
}

// ─── Single node renderer ─────────────────────────────────────────────
interface NodeProps {
  x: number;
  y: number;
  code: string;
  sex: string;
  role: string;
  fCoefficient?: number | null;
  isSubject?: boolean;
}

function NodeBox({ x, y, code, sex, role, fCoefficient, isSubject }: NodeProps) {
  const { fill, stroke } = nodeColors(sex);
  const isFemale = sex === "female";
  const cx = x + BOX_W / 2;
  const cy = y + HALF_H;
  const F  = fCoefficient ?? 0;

  const roleY  = cy - (F > 0 ? 14 : 8);
  const codeY  = cy + (F > 0 ? 2  : 8);
  const fY     = cy + 18;

  return (
    <g>
      {isFemale ? (
        <ellipse cx={cx} cy={cy} rx={BOX_W / 2} ry={HALF_H}
          fill={fill} stroke={stroke}
          strokeWidth={isSubject ? 2.5 : 2}
          strokeDasharray={isSubject ? undefined : undefined}
        />
      ) : (
        <rect x={x} y={y} width={BOX_W} height={BOX_H} rx={5}
          fill={fill} stroke={stroke}
          strokeWidth={isSubject ? 2.5 : 2}
        />
      )}

      {/* Role label (เล็ก) */}
      <text x={cx} y={roleY} textAnchor="middle" fontSize={10}
        fill="#6b7280" fontFamily="Sarabun, sans-serif">{role}</text>

      {/* Code (ใหญ่, เข้ม) */}
      <text x={cx} y={codeY} textAnchor="middle" fontSize={13} fontWeight={700}
        fill="#111827" fontFamily="Sarabun, sans-serif">{code}</text>

      {/* F coefficient */}
      {F > 0 && (
        <text x={cx} y={fY} textAnchor="middle" fontSize={10} fontWeight={600}
          fill="#374151" fontFamily="Sarabun, sans-serif">
          F: {(F * 100).toFixed(2)}%
        </text>
      )}
    </g>
  );
}

// ─── Unknown parent box ───────────────────────────────────────────────
function UnknownBox({ x, y, role }: { x: number; y: number; role: string }) {
  return (
    <g>
      <rect x={x} y={y} width={BOX_W} height={BOX_H} rx={5}
        fill="#f9fafb" stroke="#9ca3af" strokeWidth={1.5} strokeDasharray="5 4" />
      <text x={x + BOX_W / 2} y={y + HALF_H - 6} textAnchor="middle"
        fontSize={10} fill="#9ca3af" fontFamily="Sarabun, sans-serif">{role}</text>
      <text x={x + BOX_W / 2} y={y + HALF_H + 10} textAnchor="middle"
        fontSize={11} fill="#9ca3af" fontFamily="Sarabun, sans-serif">ไม่ทราบ</text>
    </g>
  );
}

// ─── Main export ──────────────────────────────────────────────────────
export function PedigreeChart({ node, animalName }: { node: PedigreeNode; animalName?: string }) {
  const svgRef = useRef<SVGSVGElement>(null);

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

  // Subject bottom-center
  const subCx = COL_SUB + BOX_W / 2;
  const subTopY = ROW_SUBJECT;

  // Dam (left)
  const damCx = COL_DAM + BOX_W / 2;
  const damBotY = ROW_PARENT + BOX_H;

  // Sire (right)
  const sireCx = COL_SIRE + BOX_W / 2;
  const sireBotY = ROW_PARENT + BOX_H;

  return (
    <div className="space-y-2">
      <div className="flex justify-end">
        <Button variant="outline" size="sm" onClick={downloadJpg} className="gap-1.5">
          <Download className="w-4 h-4" />
          <span>ดาวน์โหลด .jpg</span>
        </Button>
      </div>

      <div className="overflow-x-auto rounded-md border bg-white">
        <svg
          ref={svgRef}
          width={SVG_W}
          height={SVG_H}
          viewBox={`0 0 ${SVG_W} ${SVG_H}`}
          xmlns="http://www.w3.org/2000/svg"
        >
          {/* Lines: diagonal from parent bottom-center to subject top-center */}
          {node.dam && (
            <line
              x1={damCx}  y1={damBotY}
              x2={subCx}  y2={subTopY}
              stroke="#94a3b8" strokeWidth={1.5}
            />
          )}
          {node.sire && (
            <line
              x1={sireCx} y1={sireBotY}
              x2={subCx}  y2={subTopY}
              stroke="#94a3b8" strokeWidth={1.5}
            />
          )}

          {/* Dam (left) */}
          {node.dam ? (
            <NodeBox
              x={COL_DAM} y={ROW_PARENT}
              code={node.dam.code}
              sex={node.dam.sex}
              role="แม่พันธุ์"
              fCoefficient={node.dam.fCoefficient}
            />
          ) : (
            <UnknownBox x={COL_DAM} y={ROW_PARENT} role="แม่พันธุ์" />
          )}

          {/* Sire (right) */}
          {node.sire ? (
            <NodeBox
              x={COL_SIRE} y={ROW_PARENT}
              code={node.sire.code}
              sex={node.sire.sex}
              role="พ่อพันธุ์"
              fCoefficient={node.sire.fCoefficient}
            />
          ) : (
            <UnknownBox x={COL_SIRE} y={ROW_PARENT} role="พ่อพันธุ์" />
          )}

          {/* Subject (bottom center) */}
          <NodeBox
            x={COL_SUB} y={ROW_SUBJECT}
            code={node.code}
            sex={node.sex}
            role={node.sex === "male" ? "พ่อพันธุ์" : node.sex === "female" ? "แม่พันธุ์" : "สัตว์"}
            fCoefficient={node.fCoefficient}
            isSubject
          />

          {/* Legend */}
          <g transform={`translate(${PAD}, ${SVG_H - 22})`}>
            <rect x={0} y={0} width={12} height={12} rx={2}
              fill="#dbeafe" stroke="#3b82f6" strokeWidth={1.5} />
            <text x={16} y={10} fontSize={10} fill="#374151"
              fontFamily="Sarabun, sans-serif">พ่อพันธุ์ (สี่เหลี่ยม)</text>
            <ellipse cx={116} cy={6} rx={16} ry={8}
              fill="#fce7f3" stroke="#ec4899" strokeWidth={1.5} />
            <text x={136} y={10} fontSize={10} fill="#374151"
              fontFamily="Sarabun, sans-serif">แม่พันธุ์ (วงรี)</text>
          </g>
        </svg>
      </div>
    </div>
  );
}
