import { useGetAnimal, useGetAnimalPedigree } from "@workspace/api-client-react";
import { Link, useParams } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Calculator } from "lucide-react";
import { PedigreeChart, PedigreeNode } from "@/components/ui/pedigree-chart";

function FieldLabel({ th, en }: { th: string; en: string }) {
  return (
    <div className="flex flex-col leading-tight">
      <span className="text-sm text-muted-foreground">{th}</span>
      <span className="text-[10px] text-muted-foreground/50">{en}</span>
    </div>
  );
}

export default function AnimalDetail() {
  const { id } = useParams();
  const animalId = Number(id);

  const { data: animal, isLoading: animalLoading } = useGetAnimal(animalId);
  const { data: pedigree, isLoading: pedigreeLoading } = useGetAnimalPedigree(animalId);

  if (animalLoading || !animal) return <div>กำลังโหลด... / Loading...</div>;

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Button variant="outline" size="icon" asChild>
            <Link href="/animals"><ArrowLeft className="w-4 h-4" /></Link>
          </Button>
          <div>
            <h1 className="text-3xl font-bold text-foreground">{animal.name}</h1>
            <p className="text-muted-foreground mt-1">
              รหัส / Code: <strong>{animal.code}</strong> · สายพันธุ์ / Species: {animal.species}
            </p>
          </div>
        </div>
        <Button asChild className="bg-primary text-primary-foreground">
          <Link
            href={`/calculate?sireId=${animal.sex === 'male' ? animal.id : ''}&damId=${animal.sex === 'female' ? animal.id : ''}`}
            className="flex items-center gap-2"
          >
            <Calculator className="w-4 h-4" />
            <div className="flex flex-col items-start leading-tight">
              <span>จำลองการผสมพันธุ์</span>
              <span className="text-[10px] opacity-70">Simulate Mating</span>
            </div>
          </Link>
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="md:col-span-1">
          <CardHeader>
            <CardTitle>
              <div className="flex flex-col leading-tight">
                <span>ข้อมูลทั่วไป</span>
                <span className="text-sm font-normal text-muted-foreground">General Information</span>
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <FieldLabel th="เพศ" en="Sex" />
                <div className="font-medium mt-0.5">
                  {animal.sex === 'male' ? 'ตัวผู้ / Male' : 'ตัวเมีย / Female'}
                </div>
              </div>
              <div>
                <FieldLabel th="ฟาร์ม" en="Farm" />
                <div className="font-medium mt-0.5">{animal.farm || '—'}</div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <FieldLabel th="วันเกิด" en="Birth Date" />
                <div className="font-medium mt-0.5">
                  {animal.birthDate ? new Date(animal.birthDate).toLocaleDateString('th-TH') : '—'}
                </div>
              </div>
              <div>
                <FieldLabel th="ค่าเลือดชิดตัวเอง (F)" en="Own Inbreeding Coeff." />
                <div className="font-medium text-primary mt-0.5">
                  {animal.fCoefficient !== null && animal.fCoefficient !== undefined
                    ? `${(animal.fCoefficient * 100).toFixed(2)}%`
                    : '—'}
                </div>
              </div>
            </div>
            <div>
              <FieldLabel th="พ่อพันธุ์" en="Sire" />
              <div className="font-medium mt-0.5">{animal.sireCode || '—'}</div>
            </div>
            <div>
              <FieldLabel th="แม่พันธุ์" en="Dam" />
              <div className="font-medium mt-0.5">{animal.damCode || '—'}</div>
            </div>
            {animal.notes && (
              <div>
                <FieldLabel th="หมายเหตุ" en="Notes" />
                <div className="text-sm bg-muted/50 p-3 rounded-md mt-1">{animal.notes}</div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>
              <div className="flex flex-col leading-tight">
                <span>แผนผังสายเลือด</span>
                <span className="text-sm font-normal text-muted-foreground">Pedigree Chart</span>
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            {pedigreeLoading ? (
              <div className="h-32 flex items-center justify-center text-muted-foreground">
                กำลังสร้างผังสายเลือด... / Building pedigree...
              </div>
            ) : pedigree ? (
              <div className="min-w-[500px] py-4">
                <PedigreeChart node={pedigree as PedigreeNode} animalName={animal.name} />
              </div>
            ) : (
              <div className="text-muted-foreground text-center py-8">
                ไม่พบข้อมูลสายเลือด / No pedigree data
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
