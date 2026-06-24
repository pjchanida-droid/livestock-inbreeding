import { useListFarms, useComputeAMatrix } from "@workspace/api-client-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { RiskBadge } from "@/components/ui/risk-badge";
import { Calculator, Dna } from "lucide-react";

export default function AMatrix() {
  const { data: farms } = useListFarms();
  const [selectedFarm, setSelectedFarm] = useState<string>("all");
  const computeMatrix = useComputeAMatrix();

  const handleCompute = () => {
    computeMatrix.mutate({
      data: { farm: selectedFarm === "all" ? undefined : selectedFarm }
    });
  };

  const results = computeMatrix.data?.animals || [];
  
  // Sort descending by F percent
  const sortedResults = [...results].sort((a, b) => (b.fPercent || 0) - (a.fPercent || 0));

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground">วิเคราะห์ A-Matrix</h1>
          <p className="text-muted-foreground mt-1">ประเมินอัตราเลือดชิดของสัตว์ในฝูงทั้งหมด (Additive Relationship Matrix)</p>
        </div>
      </div>

      <Card>
        <CardHeader className="bg-muted/30 border-b border-border">
          <div className="flex flex-col sm:flex-row items-end sm:items-center justify-between gap-4">
            <div>
              <CardTitle className="text-lg flex items-center gap-2">
                <Dna className="w-5 h-5 text-primary" /> ตัวกรองข้อมูล
              </CardTitle>
              <CardDescription>เลือกฟาร์มที่ต้องการคำนวณ</CardDescription>
            </div>
            <div className="flex items-center gap-3 w-full sm:w-auto">
              <Select value={selectedFarm} onValueChange={setSelectedFarm}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="เลือกฟาร์ม" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">ทุกฟาร์ม</SelectItem>
                  {farms?.map(farm => (
                    <SelectItem key={farm} value={farm}>{farm}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button onClick={handleCompute} disabled={computeMatrix.isPending} className="whitespace-nowrap">
                {computeMatrix.isPending ? "กำลังคำนวณ..." : <><Calculator className="w-4 h-4 mr-2" /> คำนวณ</>}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead>รหัส</TableHead>
                <TableHead>ชื่อสัตว์</TableHead>
                <TableHead>เพศ</TableHead>
                <TableHead>ฟาร์ม</TableHead>
                <TableHead className="text-right">ค่าเลือดชิด F (%)</TableHead>
                <TableHead className="w-32 text-center">ระดับความเสี่ยง</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {computeMatrix.isPending ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-32 text-center text-muted-foreground">
                    กำลังประมวลผลข้อมูล...
                  </TableCell>
                </TableRow>
              ) : results.length === 0 && !computeMatrix.data ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-32 text-center text-muted-foreground">
                    กรุณากด "คำนวณ" เพื่อวิเคราะห์ข้อมูล
                  </TableCell>
                </TableRow>
              ) : sortedResults.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-32 text-center text-muted-foreground">
                    ไม่พบข้อมูลสัตว์
                  </TableCell>
                </TableRow>
              ) : (
                sortedResults.map((animal) => {
                  let riskLevel: 'low' | 'medium' | 'high' | 'critical' = 'low';
                  let riskLabel = 'ปกติ';
                  
                  const f = animal.fPercent || 0;
                  if (f > 12.5) { riskLevel = 'critical'; riskLabel = 'วิกฤต'; }
                  else if (f >= 6.25) { riskLevel = 'high'; riskLabel = 'สูง'; }
                  else if (f > 0) { riskLevel = 'medium'; riskLabel = 'เฝ้าระวัง'; }

                  return (
                    <TableRow key={animal.id} className="hover:bg-muted/30">
                      <TableCell className="font-medium">{animal.code}</TableCell>
                      <TableCell>{animal.name}</TableCell>
                      <TableCell>{animal.sex === 'male' ? 'ตัวผู้' : 'ตัวเมีย'}</TableCell>
                      <TableCell>{animal.farm || '-'}</TableCell>
                      <TableCell className="text-right font-semibold">
                        {(animal.fPercent || 0).toFixed(2)}%
                      </TableCell>
                      <TableCell className="text-center">
                        <RiskBadge level={riskLevel} label={riskLabel} />
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
