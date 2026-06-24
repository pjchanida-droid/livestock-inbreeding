import { Badge } from "@/components/ui/badge";

interface RiskBadgeProps {
  level: string;
  label?: string;
  className?: string;
}

export function RiskBadge({ level, label, className }: RiskBadgeProps) {
  let colorClass = "bg-gray-100 text-gray-800 border-gray-200";
  let fallbackLabel = label || level;

  switch (level) {
    case "safe":
      colorClass = "bg-green-100 text-green-800 border-green-200";
      fallbackLabel = label || "ปลอดภัย";
      break;
    case "low":
      colorClass = "bg-lime-100 text-lime-800 border-lime-200";
      fallbackLabel = label || "เสี่ยงต่ำ";
      break;
    case "moderate":
      colorClass = "bg-orange-100 text-orange-800 border-orange-200";
      fallbackLabel = label || "ปานกลาง";
      break;
    case "high":
      colorClass = "bg-red-100 text-red-800 border-red-200";
      fallbackLabel = label || "เสี่ยงสูง";
      break;
    case "very_high":
      colorClass = "bg-rose-900 text-red-50 border-rose-950";
      fallbackLabel = label || "เสี่ยงสูงมาก";
      break;
  }

  return (
    <Badge variant="outline" className={`font-medium ${colorClass} ${className || ""}`}>
      {fallbackLabel}
    </Badge>
  );
}
