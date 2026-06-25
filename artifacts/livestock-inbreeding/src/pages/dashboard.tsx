import { useGetInbreedingStats, useListInbreedingHistory, useListAnimals, useListFarms } from "@workspace/api-client-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { PawPrint, Activity, Calculator, AlertTriangle } from "lucide-react";
import { RiskBadge } from "@/components/ui/risk-badge";
import { useState } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

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
    
    return {
      ...stats,
      totalAnimals,
      averageF,
      riskyPairings,
      totalCalculations: stats?.totalCalculations || 0,
      riskBreakdown: stats?.riskBreakdown || []
    };
  })();

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground">ภาพรวมข้อมูลพันธุ์ประวัติ</h1>
          <p className="text-muted-foreground mt-1">ข้อมูลสถิติและพันธุ์ประวัติสัตว์ทั้งหมด</p>
        </div>
        <div className="w-full sm:w-auto">
          <Select value={selectedFarm} onValueChange={setSelectedFarm}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="เลือกฟาร์ม" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">ทุกฟาร์ม</SelectItem>
              {farms?.map(farm => (
                <SelectItem key={farm} value={farm}>{farm}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard 
          title="สัตว์ในระบบทั้งหมด" 
          value={displayStats?.totalAnimals} 
          icon={<PawPrint className="w-4 h-4 text-primary" />} 
          loading={statsLoading} 
        />
        <StatCard 
          title="คำนวณแล้ว (ครั้ง)" 
          value={displayStats?.totalCalculations} 
          icon={<Calculator className="w-4 h-4 text-blue-600" />} 
          loading={statsLoading} 
        />
        <StatCard 
          title="อัตราเลือดชิดเฉลี่ย" 
          value={displayStats ? `${(displayStats.averageF * 100).toFixed(2)}%` : undefined} 
          icon={<Activity className="w-4 h-4 text-green-600" />} 
          loading={statsLoading} 
        />
        <StatCard 
          title="การจับคู่ที่มีความเสี่ยง" 
          value={displayStats?.riskyPairings} 
          icon={<AlertTriangle className="w-4 h-4 text-orange-500" />} 
          loading={statsLoading} 
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>การกระจายตัวระดับความเสี่ยง</CardTitle>
            <CardDescription>ระดับความเสี่ยงจากการคำนวณทั้งหมด</CardDescription>
          </CardHeader>
          <CardContent>
            {statsLoading ? (
              <div className="space-y-3">
                {[1,2,3].map(i => <Skeleton key={i} className="h-10 w-full" />)}
              </div>
            ) : (
              <div className="space-y-4">
                {stats?.riskBreakdown.map((item) => (
                  <div key={item.level} className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <RiskBadge level={item.level} label={item.label} />
                    </div>
                    <span className="font-semibold text-lg">{item.count}</span>
                  </div>
                ))}
                {!stats?.riskBreakdown?.length && (
                  <div className="text-center py-8 text-muted-foreground text-sm">ยังไม่มีข้อมูลสถิติ</div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>ประวัติการคำนวณล่าสุด</CardTitle>
            <CardDescription>การคำนวณอัตราเลือดชิด 5 ครั้งล่าสุด</CardDescription>
          </CardHeader>
          <CardContent>
            {historyLoading ? (
              <div className="space-y-3">
                {[1,2,3].map(i => <Skeleton key={i} className="h-12 w-full" />)}
              </div>
            ) : (
              <div className="space-y-3">
                {history?.slice(0, 5).map((record) => (
                  <div key={record.id} className="flex justify-between items-center p-3 bg-muted/50 rounded-lg border border-border/50">
                    <div>
                      <div className="font-medium text-sm">พ่อ: {record.sireName} × แม่: {record.damName}</div>
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
                  <div className="text-center py-8 text-muted-foreground text-sm">ยังไม่มีประวัติการคำนวณ</div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function StatCard({ title, value, icon, loading }: { title: string, value?: number | string, icon: React.ReactNode, loading: boolean }) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        {icon}
      </CardHeader>
      <CardContent>
        {loading ? (
          <Skeleton className="h-8 w-16" />
        ) : (
          <div className="text-2xl font-bold">{value || 0}</div>
        )}
      </CardContent>
    </Card>
  );
}
