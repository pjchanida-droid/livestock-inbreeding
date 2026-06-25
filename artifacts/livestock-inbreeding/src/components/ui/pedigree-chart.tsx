import { Badge } from "@/components/ui/badge";

export interface PedigreeNode {
  id: number;
  name: string;
  code: string;
  sex: string;
  fCoefficient?: number;
  sire?: PedigreeNode;
  dam?: PedigreeNode;
}

function PedigreeCell({ node }: { node?: PedigreeNode }) {
  if (!node) {
    return (
      <div className="w-48 p-3 rounded-md border-2 border-dashed border-muted bg-muted/20 flex flex-col items-center justify-center text-muted-foreground h-[76px]">
        <span className="text-sm">ไม่ทราบ</span>
      </div>
    );
  }

  const isMale = node.sex === 'male';
  return (
    <div className={`w-48 p-3 rounded-md border shadow-sm flex flex-col justify-center h-[76px] relative ${isMale ? "bg-blue-50/60 border-blue-200" : "bg-pink-50/60 border-pink-200"}`}>
      <div className="font-bold text-sm truncate">{node.name}</div>
      <div className="flex justify-between items-center mt-1">
        <div className="text-xs text-muted-foreground truncate">{node.code}</div>
        {(node.fCoefficient ?? 0) > 0 && (
          <Badge variant="outline" className="text-[10px] h-[18px] px-1.5 py-0 bg-background/80 shadow-none border-muted">
            F: {((node.fCoefficient ?? 0) * 100).toFixed(2)}%
          </Badge>
        )}
      </div>
    </div>
  );
}

function PedigreeBranch({ node, depth = 0 }: { node?: PedigreeNode, depth?: number }) {
  if (depth > 3) return null;
  
  return (
    <div className="flex items-center">
      <div className="relative z-10">
        <PedigreeCell node={node} />
      </div>
      
      {depth < 3 && (
        <div className="flex flex-col gap-4 relative">
          {/* Sire */}
          <div className="flex items-center relative pl-8">
            {/* Horizontal line to Sire */}
            <div className="absolute left-0 top-1/2 w-8 border-t-2 border-muted" />
            {/* Vertical line down */}
            <div className="absolute left-0 top-1/2 h-[calc(50%+1rem)] border-l-2 border-muted" />
            <PedigreeBranch node={node?.sire} depth={depth + 1} />
          </div>
          {/* Dam */}
          <div className="flex items-center relative pl-8">
            {/* Horizontal line to Dam */}
            <div className="absolute left-0 top-1/2 w-8 border-t-2 border-muted" />
            {/* Vertical line up */}
            <div className="absolute left-0 bottom-1/2 h-[calc(50%+1rem)] border-l-2 border-muted" />
            <PedigreeBranch node={node?.dam} depth={depth + 1} />
          </div>
        </div>
      )}
    </div>
  );
}

export function PedigreeChart({ node }: { node: PedigreeNode }) {
  return (
    <div className="min-w-max pb-4 pr-4">
      <PedigreeBranch node={node} depth={0} />
    </div>
  );
}
