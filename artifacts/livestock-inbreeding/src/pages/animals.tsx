import { useListAnimals, useListFarms, getListAnimalsQueryKey } from "@workspace/api-client-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Search, Upload, FileSpreadsheet } from "lucide-react";
import { useState } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";

export default function Animals() {
  const [search, setSearch] = useState("");
  const [selectedFarm, setSelectedFarm] = useState<string>("all");
  const [importOpen, setImportOpen] = useState(false);
  const [importing, setImporting] = useState(false);
  
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: farms } = useListFarms();
  const { data: animals, isLoading } = useListAnimals(
    selectedFarm === "all" ? undefined : { farm: selectedFarm }
  );

  const filteredAnimals = animals?.filter(a => 
    a.name.toLowerCase().includes(search.toLowerCase()) || 
    a.code.toLowerCase().includes(search.toLowerCase())
  );

  const handleDownloadTemplate = () => {
    window.location.href = '/api/animals/template';
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const file = e.target.files[0];
    
    setImporting(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch('/api/animals/import', { method: 'POST', body: formData });
      const result = await res.json();
      
      if (!res.ok) {
        throw new Error(result.error || "เกิดข้อผิดพลาดในการนำเข้า");
      }
      
      toast({
        title: "นำเข้าข้อมูลสำเร็จ",
        description: `นำเข้าสำเร็จ ${result.inserted} รายการ, ข้าม ${result.skipped} รายการ${result.errors?.length ? ` (พบข้อผิดพลาด ${result.errors.length} รายการ)` : ''}`,
      });
      
      queryClient.invalidateQueries({ queryKey: getListAnimalsQueryKey() });
      setImportOpen(false);
    } catch (error: any) {
      toast({
        title: "เกิดข้อผิดพลาด",
        description: error.message || "ไม่สามารถนำเข้าข้อมูลได้",
        variant: "destructive",
      });
    } finally {
      setImporting(false);
      // Reset input
      e.target.value = "";
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground">ทะเบียนสัตว์</h1>
          <p className="text-muted-foreground mt-1">จัดการข้อมูลสัตว์ในฟาร์มทั้งหมด</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Dialog open={importOpen} onOpenChange={setImportOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" className="flex items-center gap-2">
                <Upload className="w-4 h-4" />
                นำเข้า Excel
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>นำเข้าข้อมูลสัตว์จาก Excel</DialogTitle>
                <DialogDescription>
                  ดาวน์โหลดไฟล์แม่แบบและกรอกข้อมูลสัตว์ให้ครบถ้วน จากนั้นอัปโหลดไฟล์เข้าระบบ
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-6 py-4">
                <div className="p-4 bg-muted/50 rounded-lg border border-border flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <FileSpreadsheet className="w-8 h-8 text-primary" />
                    <div>
                      <h4 className="font-medium text-sm">ไฟล์แม่แบบ Excel</h4>
                      <p className="text-xs text-muted-foreground">โครงสร้างไฟล์สำหรับนำเข้าข้อมูล</p>
                    </div>
                  </div>
                  <Button variant="secondary" size="sm" onClick={handleDownloadTemplate}>ดาวน์โหลดแม่แบบ</Button>
                </div>
                
                <div className="space-y-2 border-2 border-dashed border-border rounded-lg p-6 text-center">
                  <Upload className="w-10 h-10 text-muted-foreground mx-auto mb-2" />
                  <h4 className="font-medium text-sm">อัปโหลดไฟล์ที่กรอกข้อมูลแล้ว</h4>
                  <p className="text-xs text-muted-foreground mb-4">รองรับไฟล์ .xlsx</p>
                  <div className="relative">
                    <Input 
                      type="file" 
                      accept=".xlsx, .xls" 
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                      onChange={handleImport}
                      disabled={importing}
                    />
                    <Button disabled={importing}>
                      {importing ? "กำลังนำเข้า..." : "เลือกไฟล์ Excel"}
                    </Button>
                  </div>
                </div>
              </div>
            </DialogContent>
          </Dialog>

          <Button asChild className="shrink-0 bg-primary text-primary-foreground">
            <Link href="/animals/new" className="flex items-center gap-2">
              <Plus className="w-4 h-4" />
              เพิ่มข้อมูลสัตว์
            </Link>
          </Button>
        </div>
      </div>

      <Card>
        <div className="p-4 border-b border-border flex flex-col sm:flex-row items-start sm:items-center gap-4">
          <div className="flex items-center gap-3 flex-1">
            <Search className="w-5 h-5 text-muted-foreground" />
            <Input 
              placeholder="ค้นหาชื่อ หรือ รหัสสัตว์..." 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="max-w-sm border-0 focus-visible:ring-0 px-0"
            />
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
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50 hover:bg-muted/50">
                <TableHead>รหัส</TableHead>
                <TableHead>ชื่อสัตว์</TableHead>
                <TableHead>ฟาร์ม</TableHead>
                <TableHead>เพศ</TableHead>
                <TableHead>สายเลือด (พ่อ/แม่)</TableHead>
                <TableHead>ค่าเลือดชิด (F)</TableHead>
                <TableHead className="text-right">จัดการ</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell><Skeleton className="h-5 w-16" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-32" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-12" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-40" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-16" /></TableCell>
                    <TableCell><Skeleton className="h-8 w-20 ml-auto" /></TableCell>
                  </TableRow>
                ))
              ) : filteredAnimals?.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="h-32 text-center text-muted-foreground">
                    ไม่พบข้อมูลสัตว์
                  </TableCell>
                </TableRow>
              ) : (
                filteredAnimals?.map((animal) => (
                  <TableRow key={animal.id} className="hover:bg-muted/30">
                    <TableCell className="font-medium">{animal.code}</TableCell>
                    <TableCell>{animal.name}</TableCell>
                    <TableCell>{animal.farm || '-'}</TableCell>
                    <TableCell>{animal.sex === 'male' ? 'ผู้' : 'เมีย'}</TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {animal.sireName || '-'} / {animal.damName || '-'}
                    </TableCell>
                    <TableCell>
                      {animal.fCoefficient !== null && animal.fCoefficient !== undefined 
                        ? `${(animal.fCoefficient * 100).toFixed(2)}%` 
                        : '-'}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="outline" size="sm" asChild>
                        <Link href={`/animals/${animal.id}`}>ดูข้อมูล</Link>
                      </Button>
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
