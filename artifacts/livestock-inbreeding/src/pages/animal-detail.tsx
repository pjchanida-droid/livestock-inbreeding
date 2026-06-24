import { useGetAnimal, useGetAnimalPedigree } from "@workspace/api-client-react";
import { Link, useParams } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Calculator } from "lucide-react";

export default function AnimalDetail() {
  const { id } = useParams();
  const animalId = Number(id);
  
  const { data: animal, isLoading: animalLoading } = useGetAnimal(animalId);
  const { data: pedigree, isLoading: pedigreeLoading } = useGetAnimalPedigree(animalId);

  if (animalLoading || !animal) return <div>กำลังโหลด...</div>;

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Button variant="outline" size="icon" asChild>
            <Link href="/animals"><ArrowLeft className="w-4 h-4" /></Link>
          </Button>
          <div>
            <h1 className="text-3xl font-bold text-foreground">{animal.name}</h1>
            <p className="text-muted-foreground mt-1">รหัส: {animal.code} • สายพันธุ์: {animal.species}</p>
          </div>
        </div>
        <Button asChild className="bg-primary text-primary-foreground">
          <Link href={`/calculate?sireId=${animal.sex === 'male' ? animal.id : ''}&damId=${animal.sex === 'female' ? animal.id : ''}`} className="flex items-center gap-2">
            <Calculator className="w-4 h-4" />
            นำไปคำนวณเลือดชิด
          </Link>
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="md:col-span-1">
          <CardHeader>
            <CardTitle>ข้อมูลทั่วไป</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="text-sm text-muted-foreground">เพศ</div>
                <div className="font-medium">{animal.sex === 'male' ? 'ตัวผู้' : 'ตัวเมีย'}</div>
              </div>
              <div>
                <div className="text-sm text-muted-foreground">ฟาร์ม</div>
                <div className="font-medium">{animal.farm || '-'}</div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="text-sm text-muted-foreground">วันเกิด</div>
                <div className="font-medium">{animal.birthDate ? new Date(animal.birthDate).toLocaleDateString('th-TH') : '-'}</div>
              </div>
              <div>
                <div className="text-sm text-muted-foreground">ค่าเลือดชิดตัวเอง (F)</div>
                <div className="font-medium text-primary">
                  {animal.fCoefficient !== null && animal.fCoefficient !== undefined 
                    ? `${(animal.fCoefficient * 100).toFixed(2)}%` 
                    : '-'}
                </div>
              </div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground">พ่อพันธุ์</div>
              <div className="font-medium">{animal.sireName || '-'}</div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground">แม่พันธุ์</div>
              <div className="font-medium">{animal.damName || '-'}</div>
            </div>
            {animal.notes && (
              <div>
                <div className="text-sm text-muted-foreground">หมายเหตุ</div>
                <div className="text-sm bg-muted/50 p-3 rounded-md mt-1">{animal.notes}</div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>แผนผังสายเลือด (Pedigree)</CardTitle>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            {pedigreeLoading ? (
              <div className="h-32 flex items-center justify-center text-muted-foreground">กำลังสร้างผังสายเลือด...</div>
            ) : pedigree ? (
              <div className="min-w-[500px] py-4">
                <PedigreeTree node={pedigree} depth={0} />
              </div>
            ) : (
              <div className="text-muted-foreground text-center py-8">ไม่พบข้อมูลสายเลือด</div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// Simple recursive component for tree visualization
function PedigreeTree({ node, depth }: { node: any; depth: number }) {
  if (!node) return null;
  const isMale = node.sex === 'male';
  
  return (
    <div className={`flex flex-col gap-2 ${depth > 0 ? "ml-8 pl-4 border-l-2 border-border/50" : ""}`}>
      <div className={`inline-flex flex-col p-3 rounded border shadow-sm max-w-xs ${isMale ? "bg-blue-50/50 border-blue-200" : "bg-pink-50/50 border-pink-200"}`}>
        <div className="font-bold text-sm">{node.name}</div>
        <div className="text-xs text-muted-foreground">{node.code}</div>
      </div>
      
      {(node.sire || node.dam) && (
        <div className="space-y-4 mt-2">
          {node.sire ? <PedigreeTree node={node.sire} depth={depth + 1} /> : <div className="ml-8 pl-4 border-l-2 border-border/50 text-xs text-muted-foreground italic">ไม่ทราบพ่อ</div>}
          {node.dam ? <PedigreeTree node={node.dam} depth={depth + 1} /> : <div className="ml-8 pl-4 border-l-2 border-border/50 text-xs text-muted-foreground italic">ไม่ทราบแม่</div>}
        </div>
      )}
    </div>
  );
}
