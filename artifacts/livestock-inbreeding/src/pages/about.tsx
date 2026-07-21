import { Dna, User, Building2, MapPin, BadgeCheck, ShieldAlert } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

export default function About() {
  return (
    <div className="space-y-6 max-w-2xl mx-auto animate-in fade-in duration-500">
      <div className="flex items-center gap-4">
        <div className="bg-primary text-primary-foreground p-3 rounded-xl">
          <Dna className="w-7 h-7" />
        </div>
        <div>
          <h1 className="text-3xl font-bold text-foreground">Inbreeding Cal.</h1>
          <p className="text-muted-foreground mt-0.5">ระบบคำนวณอัตราเลือดชิด — Livestock Inbreeding Calculator</p>
        </div>
      </div>

      {/* Version */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <BadgeCheck className="w-4 h-4 text-primary" />
            เวอร์ชัน <span className="text-[10px] font-normal text-muted-foreground ml-1">Version</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-1 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Version</span>
            <span className="font-semibold">1.0</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Release</span>
            <span className="font-semibold">First Public Release (2026)</span>
          </div>
        </CardContent>
      </Card>

      {/* Developer */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <User className="w-4 h-4 text-primary" />
            ผู้พัฒนา <span className="text-[10px] font-normal text-muted-foreground ml-1">Developer</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div className="flex items-start gap-3">
            <User className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
            <div>
              <p className="font-semibold">Chanida Panjan</p>
            </div>
          </div>
          <Separator />
          <div className="flex items-start gap-3">
            <Building2 className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
            <div className="space-y-0.5">
              <p className="font-medium">Bureau of Animal Husbandry and Genetic Improvement</p>
              <p className="text-muted-foreground">Department of Livestock Development</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <MapPin className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
            <p className="text-muted-foreground">Pathum Thani, Thailand</p>
          </div>
        </CardContent>
      </Card>

      {/* License */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-primary" />
            ลิขสิทธิ์การใช้งาน <span className="text-[10px] font-normal text-muted-foreground ml-1">License</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div className="rounded-md bg-green-50 border border-green-200 px-4 py-3 text-green-800">
            <p className="font-medium mb-0.5">✓ อนุญาตให้ใช้งานฟรี</p>
            <p className="text-green-700">Free for academic, educational, and research use.</p>
          </div>
          <div className="rounded-md bg-red-50 border border-red-200 px-4 py-3 text-red-800">
            <p className="font-medium mb-0.5">✗ ข้อห้าม</p>
            <p className="text-red-700">Commercial use, redistribution, resale, or incorporation into commercial products is prohibited without prior written permission from the author.</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
