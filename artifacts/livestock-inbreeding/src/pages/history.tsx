import { useListInbreedingHistory } from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { RiskBadge } from "@/components/ui/risk-badge";
import { Skeleton } from "@/components/ui/skeleton";

function BiHead({ th, en }: { th: string; en: string }) {
  return (
    <div className="flex flex-col leading-tight">
      <span>{th}</span>
      <span className="text-[10px] opacity-50 font-normal">{en}</span>
    </div>
  );
}

export default function History() {
  const { data: history, isLoading } = useListInbreedingHistory();

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div>
        <h1 className="text-3xl font-bold text-foreground">ประวัติการคำนวณ</h1>
        <p className="text-muted-foreground mt-1">
          บันทึกประวัติการคำนวณอัตราเลือดชิดทั้งหมดในระบบ <span className="text-xs opacity-60">/ All Inbreeding Calculation Records</span>
        </p>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead><BiHead th="วันเวลาที่คำนวณ" en="Date / Time" /></TableHead>
                <TableHead><BiHead th="พ่อพันธุ์" en="Sire" /></TableHead>
                <TableHead><BiHead th="แม่พันธุ์" en="Dam" /></TableHead>
                <TableHead className="text-right"><BiHead th="ค่า F (%)" en="F Coefficient" /></TableHead>
                <TableHead><BiHead th="ระดับความเสี่ยง" en="Risk Level" /></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell><Skeleton className="h-5 w-32" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                    <TableCell className="text-right"><Skeleton className="h-5 w-16 ml-auto" /></TableCell>
                    <TableCell><Skeleton className="h-6 w-20" /></TableCell>
                  </TableRow>
                ))
              ) : history?.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="h-32 text-center text-muted-foreground">
                    ไม่มีประวัติการคำนวณ / No calculation history
                  </TableCell>
                </TableRow>
              ) : (
                history?.map((record) => (
                  <TableRow key={record.id} className="hover:bg-muted/30">
                    <TableCell className="text-muted-foreground">
                      {new Date(record.calculatedAt).toLocaleString('th-TH')}
                    </TableCell>
                    <TableCell className="font-medium">{record.sireName}</TableCell>
                    <TableCell className="font-medium">{record.damName}</TableCell>
                    <TableCell className="text-right font-bold tabular-nums">
                      {record.fPercent?.toFixed(2)}%
                    </TableCell>
                    <TableCell>
                      <RiskBadge level={record.riskLevel} label={record.riskLabel} />
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
