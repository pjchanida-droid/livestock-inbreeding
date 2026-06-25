import { useGetInbreedingStats, useListInbreedingHistory, useListAnimals, useListFarms } from "@workspace/api-client-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { PawPrint, Activity, Calculator, AlertTriangle } from "lucide-react";
import { RiskBadge } from "@/components/ui/risk-badge";
import { useState } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

function BiLabel({ th, en, className }: { th: string; en: string; className?: string }) {
  return (
    <div className={`flex flex-col leading-tight ${className ?? ""}`}>
      <span>{th}</span>
      <span className="text-[10px] opacity-50 font-normal">{en}</span>
    </div>
  );
}

export default function Dashboard() {
  const { data: stats, isLoading: statsLoading } = useGetInbreedingStats();
  const { data: history, isLoading: historyLoading } = useListInbreedingHistory();
  const { data: animals } = useListAnimals();
  const { data: farms } = useListFarms();

  const [selectedFarm, setSelectedFarm] = useState<string>("all");

  const displayStats = (() => {
    if (selectedFarm === "all") return stats;
    if (!animals) return stats;
    const filteredAnimals = animals.filter(a => a.farm === selectedFarm);
    const totalAnimals = filteredAnimals.length;
    let totalF = 0;
    let riskyPairings = 0;
    filteredAnimals.forEach(a => {
      if (a.fCoefficient) {
        totalF += a.fCoefficient;
        if (a.fCoefficient > 0.125) riskyPairings++;
      }
    });
    const averageF = totalAnimals > 0 ? totalF / totalAnimals : 0;
    return { ...stats, totalAnimals, averageF, riskyPairings, totalCalculations: stats?.totalCalculations || 0, riskBreakdown: stats?.riskBreakdown || [] };
  })();

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground">ภาพรวมข้อมูลพันธุ์ประวัติ</h1>
          <p className="text-muted-foreground mt-1">
            ข้อมูลสถิติและพันธุ์ประวัติสัตว์ทั้งหมด <span className="text-xs opacity-60">/ Pedigree & Statistics Overview</span>
          </p>
        </div>
        <div className="w-full sm:w-auto">
          <Select value={selectedFarm} onValueChange={setSelectedFarm}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="เลือกฟาร์ม / Farm" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">ทุกฟาร์ม / All Farms</SelectItem>
              {farms?.map(farm => (
                <SelectItem key={farm} value={farm}>{farm}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          th="สัตว์ในระบบทั้งหมด" en="Total Animals"
          value={displayStats?.totalAnimals}
          icon={<PawPrint className="w-4 h-4 text-primary" />}
          loading={statsLoading}
        />
        <StatCard
          th="คำนวณแล้ว (ครั้ง)" en="Total Calculations"
          value={displayStats?.totalCalculations}
          icon={<Calculator className="w-4 h-4 text-blue-600" />}
          loading={statsLoading}
        />
        <StatCard
          th="อัตราเลือดชิดเฉลี่ย" en="Average Inbreeding (F)"
          value={displayStats ? `${(displayStats.averageF * 100).toFixed(2)}%` : undefined}
          icon={<Activity className="w-4 h-4 text-green-600" />}
          loading={statsLoading}
        />
        <StatCard
          th="การจับคู่ที่มีความเสี่ยง" en="High-Risk Pairings"
          value={displayStats?.riskyPairings}
          icon={<AlertTriangle className="w-4 h-4 text-orange-500" />}
          loading={statsLoading}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>
              <BiLabel th="การกระจายตัวระดับความเสี่ยง" en="Risk Level Distribution" />
            </CardTitle>
            <CardDescription>ระดับความเสี่ยงจากการคำนวณทั้งหมด / Based on all calculations</CardDescription>
          </CardHeader>
          <CardContent>
            {statsLoading ? (
              <div className="space-y-3">{[1,2,3].map(i => <Skeleton key={i} className="h-10 w-full" />)}</div>
            ) : (
              <div className="space-y-4">
                {stats?.riskBreakdown.map((item) => (
                  <div key={item.level} className="flex items-center justify-between">
                    <RiskBadge level={item.level} label={item.label} />
                    <span className="font-semibold text-lg">{item.count}</span>
                  </div>
                ))}
                {!stats?.riskBreakdown?.length && (
                  <div className="text-center py-8 text-muted-foreground text-sm">ยังไม่มีข้อมูลสถิติ / No statistics yet</div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>
              <BiLabel th="ประวัติการคำนวณล่าสุด" en="Recent Calculations" />
            </CardTitle>
            <CardDescription>การคำนวณอัตราเลือดชิด 5 ครั้งล่าสุด / Last 5 inbreeding calculations</CardDescription>
          </CardHeader>
          <CardContent>
            {historyLoading ? (
              <div className="space-y-3">{[1,2,3].map(i => <Skeleton key={i} className="h-12 w-full" />)}</div>
            ) : (
              <div className="space-y-3">
                {history?.slice(0, 5).map((record) => (
                  <div key={record.id} className="flex justify-between items-center p-3 bg-muted/50 rounded-lg border border-border/50">
                    <div>
                      <div className="font-medium text-sm">
                        <span className="text-muted-foreground text-xs">พ่อ/Sire:</span> {record.sireName}{" "}
                        <span className="text-muted-foreground">×</span>{" "}
                        <span className="text-muted-foreground text-xs">แม่/Dam:</span> {record.damName}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {new Date(record.calculatedAt).toLocaleDateString('th-TH')}
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <RiskBadge level={record.riskLevel} label={record.riskLabel} />
                      <span className="text-xs font-bold">F = {record.fPercent?.toFixed(2)}%</span>
                    </div>
                  </div>
                ))}
                {!history?.length && (
                  <div className="text-center py-8 text-muted-foreground text-sm">ยังไม่มีประวัติการคำนวณ / No calculation history</div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function StatCard({ th, en, value, icon, loading }: { th: string; en: string; value?: number | string; icon: React.ReactNode; loading: boolean }) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <div className="flex flex-col leading-tight">
          <span className="text-sm font-medium text-muted-foreground">{th}</span>
          <span className="text-[10px] text-muted-foreground/50">{en}</span>
        </div>
        {icon}
      </CardHeader>
      <CardContent>
        {loading ? <Skeleton className="h-8 w-16" /> : <div className="text-2xl font-bold">{value ?? 0}</div>}
      </CardContent>
    </Card>
  );
}
