import { useListAnimals, useListFarms, getListAnimalsQueryKey, Animal } from "@workspace/api-client-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Search, Upload, FileSpreadsheet, ArrowDownUp, Pencil, Trash2 } from "lucide-react";
import { useState } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import * as XLSX from "xlsx";

const editSchema = z.object({
  name: z.string().min(1, "กรุณาระบุชื่อ"),
  code: z.string().min(1, "กรุณาระบุรหัส"),
  species: z.string().min(1, "กรุณาระบุสายพันธุ์"),
  farm: z.string().min(1, "กรุณาระบุฟาร์ม"),
  sex: z.enum(["male", "female", "unknown"]),
  sireId: z.number().nullable(),
  damId: z.number().nullable(),
  birthDate: z.string().nullable(),
  notes: z.string().nullable(),
});

export default function Animals() {
  const [search, setSearch] = useState("");
  const [selectedFarm, setSelectedFarm] = useState<string>("all");
  const [importOpen, setImportOpen] = useState(false);
  const [importing, setImporting] = useState(false);
  const [sortByF, setSortByF] = useState(false);
  
  const [editingAnimal, setEditingAnimal] = useState<Animal | null>(null);
  const [deletingAnimal, setDeletingAnimal] = useState<Animal | null>(null);

  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: farms } = useListFarms();
  const { data: animals, isLoading } = useListAnimals(
    selectedFarm === "all" ? undefined : { farm: selectedFarm }
  );

  const editForm = useForm<z.infer<typeof editSchema>>({
    resolver: zodResolver(editSchema),
    defaultValues: {
      name: "", code: "", species: "", farm: "", sex: "unknown", sireId: null, damId: null, birthDate: "", notes: ""
    }
  });

  const males = animals?.filter(a => a.sex === "male") || [];
  const females = animals?.filter(a => a.sex === "female") || [];

  const handleEditClick = (animal: Animal) => {
    setEditingAnimal(animal);
    editForm.reset({
      name: animal.name,
      code: animal.code,
      species: animal.species || "",
      farm: animal.farm || "",
      sex: animal.sex as any,
      sireId: animal.sireId || null,
      damId: animal.damId || null,
      birthDate: animal.birthDate ? new Date(animal.birthDate).toISOString().split('T')[0] : "",
      notes: animal.notes || "",
    });
  };

  const handleEditSubmit = async (values: z.infer<typeof editSchema>) => {
    if (!editingAnimal) return;
    try {
      const res = await fetch(`/api/animals/${editingAnimal.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      if (!res.ok) throw new Error("เกิดข้อผิดพลาดในการบันทึก");
      toast({ title: "บันทึกข้อมูลสำเร็จ" });
      queryClient.invalidateQueries({ queryKey: getListAnimalsQueryKey() });
      setEditingAnimal(null);
    } catch (error: any) {
      toast({ title: "เกิดข้อผิดพลาด", description: error.message, variant: "destructive" });
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deletingAnimal) return;
    try {
      const res = await fetch(`/api/animals/${deletingAnimal.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("เกิดข้อผิดพลาดในการลบ");
      toast({ title: "ลบข้อมูลสำเร็จ" });
      queryClient.invalidateQueries({ queryKey: getListAnimalsQueryKey() });
      setDeletingAnimal(null);
    } catch (error: any) {
      toast({ title: "เกิดข้อผิดพลาด", description: error.message, variant: "destructive" });
    }
  };

  const filteredAnimals = animals?.filter(a => 
    a.name.toLowerCase().includes(search.toLowerCase()) || 
    a.code.toLowerCase().includes(search.toLowerCase())
  ) || [];

  const sortedAnimals = [...filteredAnimals].sort((a, b) => {
    if (!sortByF) return 0;
    return (b.fCoefficient || 0) - (a.fCoefficient || 0);
  });

  const handleDownloadTemplate = () => {
    window.location.href = '/api/animals/template';
  };

  const handleExport = () => {
    const wsData = sortedAnimals.map(a => ({
      "รหัส": a.code,
      "ชื่อสัตว์": a.name,
      "ฟาร์ม": a.farm || "",
      "เพศ": a.sex === "male" ? "ผู้" : a.sex === "female" ? "เมีย" : "ไม่ระบุ",
      "พ่อพันธุ์": a.sireName || "",
      "แม่พันธุ์": a.damName || "",
      "อัตราเลือดชิด(%)": a.fCoefficient ? (a.fCoefficient * 100).toFixed(2) : ""
    }));
    const ws = XLSX.utils.json_to_sheet(wsData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Animals");
    XLSX.writeFile(wb, "animals_export.xlsx");
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
          <Button variant="outline" className="flex items-center gap-2" onClick={handleExport}>
            <FileSpreadsheet className="w-4 h-4" />
            Export Excel
          </Button>
          
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
          <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
            <Button
              variant={sortByF ? "default" : "outline"}
              size="sm"
              onClick={() => setSortByF(!sortByF)}
              className="flex items-center gap-2"
            >
              <ArrowDownUp className="w-4 h-4" />
              {sortByF ? "เรียงตาม F ↓" : "ค่าเลือดชิด"}
            </Button>
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
                <TableHead>อัตราเลือดชิด (%)</TableHead>
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
              ) : sortedAnimals.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="h-32 text-center text-muted-foreground">
                    ไม่พบข้อมูลสัตว์
                  </TableCell>
                </TableRow>
              ) : (
                sortedAnimals.map((animal) => (
                  <TableRow key={animal.id} className="hover:bg-muted/30">
                    <TableCell className="font-medium">{animal.code}</TableCell>
                    <TableCell>{animal.name}</TableCell>
                    <TableCell>{animal.farm || '-'}</TableCell>
                    <TableCell>{animal.sex === 'male' ? 'ผู้' : animal.sex === 'female' ? 'เมีย' : 'ไม่ระบุ'}</TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {animal.sireName || '-'} / {animal.damName || '-'}
                    </TableCell>
                    <TableCell>
                      {animal.fCoefficient !== null && animal.fCoefficient !== undefined 
                        ? `${(animal.fCoefficient * 100).toFixed(2)}%` 
                        : '-'}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon" asChild>
                          <Link href={`/animals/${animal.id}`}><Search className="w-4 h-4" /></Link>
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => handleEditClick(animal)}>
                          <Pencil className="w-4 h-4 text-blue-600" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => setDeletingAnimal(animal)}>
                          <Trash2 className="w-4 h-4 text-red-600" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={!!editingAnimal} onOpenChange={(open) => !open && setEditingAnimal(null)}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>แก้ไขข้อมูลสัตว์</DialogTitle>
          </DialogHeader>
          <Form {...editForm}>
            <form onSubmit={editForm.handleSubmit(handleEditSubmit)} className="space-y-4">
              <FormField control={editForm.control} name="code" render={({ field }) => (
                <FormItem><FormLabel>รหัส</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={editForm.control} name="name" render={({ field }) => (
                <FormItem><FormLabel>ชื่อสัตว์</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={editForm.control} name="species" render={({ field }) => (
                <FormItem><FormLabel>สายพันธุ์</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={editForm.control} name="farm" render={({ field }) => (
                <FormItem><FormLabel>ฟาร์ม</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={editForm.control} name="sex" render={({ field }) => (
                <FormItem><FormLabel>เพศ</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl><SelectContent><SelectItem value="male">ผู้</SelectItem><SelectItem value="female">เมีย</SelectItem><SelectItem value="unknown">ไม่ระบุ</SelectItem></SelectContent></Select><FormMessage /></FormItem>
              )} />
              <FormField control={editForm.control} name="sireId" render={({ field }) => (
                <FormItem><FormLabel>พ่อพันธุ์</FormLabel><Select onValueChange={(v) => field.onChange(v ? Number(v) : null)} value={field.value?.toString() || ""}><FormControl><SelectTrigger><SelectValue placeholder="เลือกพ่อพันธุ์" /></SelectTrigger></FormControl><SelectContent><SelectItem value=" ">ไม่ระบุ</SelectItem>{males.map(m => <SelectItem key={m.id} value={m.id.toString()}>{m.name} ({m.code})</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>
              )} />
              <FormField control={editForm.control} name="damId" render={({ field }) => (
                <FormItem><FormLabel>แม่พันธุ์</FormLabel><Select onValueChange={(v) => field.onChange(v ? Number(v) : null)} value={field.value?.toString() || ""}><FormControl><SelectTrigger><SelectValue placeholder="เลือกแม่พันธุ์" /></SelectTrigger></FormControl><SelectContent><SelectItem value=" ">ไม่ระบุ</SelectItem>{females.map(f => <SelectItem key={f.id} value={f.id.toString()}>{f.name} ({f.code})</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>
              )} />
              <div className="flex justify-end gap-2 pt-4">
                <Button type="button" variant="outline" onClick={() => setEditingAnimal(null)}>ยกเลิก</Button>
                <Button type="submit">บันทึก</Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deletingAnimal} onOpenChange={(open) => !open && setDeletingAnimal(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>ยืนยันการลบ</AlertDialogTitle>
            <AlertDialogDescription>
              ยืนยันการลบ {deletingAnimal?.name}? ข้อมูลจะถูกลบถาวรและไม่สามารถกู้คืนได้
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>ยกเลิก</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteConfirm} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              ลบข้อมูล
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
