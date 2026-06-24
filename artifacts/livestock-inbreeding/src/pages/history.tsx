import { useListInbreedingHistory } from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { RiskBadge } from "@/components/ui/risk-badge";
import { Skeleton } from "@/components/ui/skeleton";

export default function History() {
  const { data: history, isLoading } = useListInbreedingHistory();

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div>
        <h1 className="text-3xl font-bold text-foreground">ประวัติการคำนวณ</h1>
        <p className="text-muted-foreground mt-1">บันทึกประวัติการคำนวณอัตราเลือดชิดทั้งหมดในระบบ</p>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead>วันเวลาที่คำนวณ</TableHead>
                <TableHead>พ่อพันธุ์</TableHead>
                <TableHead>แม่พันธุ์</TableHead>
                <TableHead className="text-right">ค่า F (%)</TableHead>
                <TableHead>ระดับความเสี่ยง</TableHead>
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
                    ไม่มีประวัติการคำนวณ
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
