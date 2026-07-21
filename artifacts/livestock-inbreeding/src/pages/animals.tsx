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
      "พ่อพันธุ์ (ID)": a.sireCode || "",
      "แม่พันธุ์ (ID)": a.damCode || "",
      "อัตราเลือดชิด(%)": a.fCoefficient ? (a.fCoefficient * 100).toFixed(2) : ""
    }));
    const ws = XLSX.utils.json_to_sheet(wsData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Animals");
    const farmLabel = selectedFarm === "all" ? "ทุกฟาร์ม" : selectedFarm;
    const safeFileName = `animals_${selectedFarm === "all" ? "all" : selectedFarm.replace(/[^a-zA-Zก-๙0-9_-]/g, "_")}_export.xlsx`;
    toast({
      title: `Export สำเร็จ (${sortedAnimals.length} รายการ)`,
      description: `ฟาร์ม: ${farmLabel}`,
    });
    XLSX.writeFile(wb, safeFileName);
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
          <p className="text-muted-foreground mt-1">
            จัดการข้อมูลสัตว์ในฟาร์มทั้งหมด <span className="text-xs opacity-60">/ Animal Registry Management</span>
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" className="flex items-center gap-2" onClick={handleExport}>
            <FileSpreadsheet className="w-4 h-4" />
            <div className="flex flex-col items-start leading-tight">
              <span>Export Excel</span>
              <span className="text-[9px] opacity-50">ส่งออกข้อมูล</span>
            </div>
          </Button>

          <Dialog open={importOpen} onOpenChange={setImportOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" className="flex items-center gap-2">
                <Upload className="w-4 h-4" />
                <div className="flex flex-col items-start leading-tight">
                  <span>นำเข้า Excel</span>
                  <span className="text-[9px] opacity-50">Import Excel</span>
                </div>
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>
                  นำเข้าข้อมูลสัตว์จาก Excel
                  <span className="block text-sm font-normal text-muted-foreground">Import Animal Data from Excel</span>
                </DialogTitle>
                <DialogDescription>
                  ดาวน์โหลดไฟล์แม่แบบและกรอกข้อมูลสัตว์ให้ครบถ้วน จากนั้นอัปโหลดไฟล์เข้าระบบ
                  <span className="block text-[11px] mt-0.5">Download the template, fill in animal data, then upload the file.</span>
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-6 py-4">
                <div className="p-4 bg-muted/50 rounded-lg border border-border flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <FileSpreadsheet className="w-8 h-8 text-primary" />
                    <div>
                      <h4 className="font-medium text-sm">ไฟล์แม่แบบ Excel <span className="text-[10px] text-muted-foreground font-normal">/ Template</span></h4>
                      <p className="text-xs text-muted-foreground">โครงสร้างไฟล์สำหรับนำเข้าข้อมูล / File structure for import</p>
                    </div>
                  </div>
                  <Button variant="secondary" size="sm" onClick={handleDownloadTemplate}>
                    <div className="flex flex-col items-center leading-tight">
                      <span>ดาวน์โหลดแม่แบบ</span>
                      <span className="text-[9px] opacity-60">Download Template</span>
                    </div>
                  </Button>
                </div>

                <div className="space-y-2 border-2 border-dashed border-border rounded-lg p-6 text-center">
                  <Upload className="w-10 h-10 text-muted-foreground mx-auto mb-2" />
                  <h4 className="font-medium text-sm">อัปโหลดไฟล์ที่กรอกข้อมูลแล้ว <span className="text-[10px] font-normal text-muted-foreground">/ Upload Filled File</span></h4>
                  <p className="text-xs text-muted-foreground mb-4">รองรับไฟล์ .xlsx / Supports .xlsx files</p>
                  <div className="relative">
                    <Input
                      type="file"
                      accept=".xlsx, .xls"
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                      onChange={handleImport}
                      disabled={importing}
                    />
                    <Button disabled={importing}>
                      {importing ? "กำลังนำเข้า... / Importing..." : "เลือกไฟล์ Excel / Choose File"}
                    </Button>
                  </div>
                </div>
              </div>
            </DialogContent>
          </Dialog>

          <Button asChild className="shrink-0 bg-primary text-primary-foreground">
            <Link href="/animals/new" className="flex items-center gap-2">
              <Plus className="w-4 h-4" />
              <div className="flex flex-col items-start leading-tight">
                <span>เพิ่มข้อมูลสัตว์</span>
                <span className="text-[9px] opacity-70">Add Animal</span>
              </div>
            </Link>
          </Button>
        </div>
      </div>

      <Card>
        <div className="p-4 border-b border-border flex flex-col sm:flex-row items-start sm:items-center gap-4">
          <div className="flex items-center gap-3 flex-1">
            <Search className="w-5 h-5 text-muted-foreground" />
            <Input
              placeholder="ค้นหาชื่อ หรือ รหัสสัตว์... / Search name or code..."
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
              <div className="flex flex-col items-start leading-tight">
                <span>{sortByF ? "เรียงตาม F ↓" : "ค่าเลือดชิด"}</span>
                <span className="text-[9px] opacity-50">{sortByF ? "Sorted by F" : "Sort by Inbreeding"}</span>
              </div>
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
                <TableHead><div className="flex flex-col leading-tight"><span>รหัส</span><span className="text-[10px] opacity-50 font-normal">Code</span></div></TableHead>
                <TableHead><div className="flex flex-col leading-tight"><span>สถานะ</span><span className="text-[10px] opacity-50 font-normal">Status</span></div></TableHead>
                <TableHead><div className="flex flex-col leading-tight"><span>ฟาร์ม</span><span className="text-[10px] opacity-50 font-normal">Farm</span></div></TableHead>
                <TableHead><div className="flex flex-col leading-tight"><span>เพศ</span><span className="text-[10px] opacity-50 font-normal">Sex</span></div></TableHead>
                <TableHead><div className="flex flex-col leading-tight"><span>พ่อ/แม่</span><span className="text-[10px] opacity-50 font-normal">Sire/Dam</span></div></TableHead>
                <TableHead><div className="flex flex-col leading-tight"><span>อัตราเลือดชิด (%)</span><span className="text-[10px] opacity-50 font-normal">Inbreeding Coeff.</span></div></TableHead>
                <TableHead className="text-right"><div className="flex flex-col items-end leading-tight"><span>จัดการ</span><span className="text-[10px] opacity-50 font-normal">Actions</span></div></TableHead>
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
                    <TableCell>
                      {animal.sex === 'male'
                        ? <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">พ่อพันธุ์</span>
                        : animal.sex === 'female'
                        ? <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-pink-100 text-pink-800">แม่พันธุ์</span>
                        : <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-600">อื่นๆ</span>
                      }
                    </TableCell>
                    <TableCell>{animal.farm || '-'}</TableCell>
                    <TableCell>{animal.sex === 'male' ? 'ผู้' : animal.sex === 'female' ? 'เมีย' : 'ไม่ระบุ'}</TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {animal.sireCode || '-'} / {animal.damCode || '-'}
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
            <DialogTitle>
              แก้ไขข้อมูลสัตว์
              <span className="block text-sm font-normal text-muted-foreground">Edit Animal Data</span>
            </DialogTitle>
          </DialogHeader>
          <Form {...editForm}>
            <form onSubmit={editForm.handleSubmit(handleEditSubmit)} className="space-y-4">
              <FormField control={editForm.control} name="code" render={({ field }) => (
                <FormItem><FormLabel><span>รหัส <span className="text-[10px] text-muted-foreground font-normal">/ Code</span></span></FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={editForm.control} name="name" render={({ field }) => (
                <FormItem><FormLabel><span>ชื่อสัตว์ <span className="text-[10px] text-muted-foreground font-normal">/ Name</span></span></FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={editForm.control} name="species" render={({ field }) => (
                <FormItem><FormLabel><span>สายพันธุ์ <span className="text-[10px] text-muted-foreground font-normal">/ Species</span></span></FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={editForm.control} name="farm" render={({ field }) => (
                <FormItem><FormLabel><span>ฟาร์ม <span className="text-[10px] text-muted-foreground font-normal">/ Farm</span></span></FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={editForm.control} name="sex" render={({ field }) => (
                <FormItem><FormLabel><span>เพศ <span className="text-[10px] text-muted-foreground font-normal">/ Sex</span></span></FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl><SelectContent><SelectItem value="male">ผู้ / Male</SelectItem><SelectItem value="female">เมีย / Female</SelectItem><SelectItem value="unknown">ไม่ระบุ / Unknown</SelectItem></SelectContent></Select><FormMessage /></FormItem>
              )} />
              <FormField control={editForm.control} name="sireId" render={({ field }) => (
                <FormItem><FormLabel><span>พ่อพันธุ์ <span className="text-[10px] text-muted-foreground font-normal">/ Sire</span></span></FormLabel><Select onValueChange={(v) => field.onChange(v ? Number(v) : null)} value={field.value?.toString() || ""}><FormControl><SelectTrigger><SelectValue placeholder="เลือกพ่อพันธุ์ / Select Sire" /></SelectTrigger></FormControl><SelectContent><SelectItem value=" ">ไม่ระบุ / None</SelectItem>{males.map(m => <SelectItem key={m.id} value={m.id.toString()}>{m.name} ({m.code})</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>
              )} />
              <FormField control={editForm.control} name="damId" render={({ field }) => (
                <FormItem><FormLabel><span>แม่พันธุ์ <span className="text-[10px] text-muted-foreground font-normal">/ Dam</span></span></FormLabel><Select onValueChange={(v) => field.onChange(v ? Number(v) : null)} value={field.value?.toString() || ""}><FormControl><SelectTrigger><SelectValue placeholder="เลือกแม่พันธุ์ / Select Dam" /></SelectTrigger></FormControl><SelectContent><SelectItem value=" ">ไม่ระบุ / None</SelectItem>{females.map(f => <SelectItem key={f.id} value={f.id.toString()}>{f.name} ({f.code})</SelectItem>)}</SelectContent></Select><FormMessage /></FormItem>
              )} />
              <div className="flex justify-end gap-2 pt-4">
                <Button type="button" variant="outline" onClick={() => setEditingAnimal(null)}>
                  <div className="flex flex-col items-center leading-tight">
                    <span>ยกเลิก</span>
                    <span className="text-[9px] opacity-50">Cancel</span>
                  </div>
                </Button>
                <Button type="submit">
                  <div className="flex flex-col items-center leading-tight">
                    <span>บันทึก</span>
                    <span className="text-[9px] opacity-70">Save</span>
                  </div>
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deletingAnimal} onOpenChange={(open) => !open && setDeletingAnimal(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              ยืนยันการลบ
              <span className="block text-sm font-normal text-muted-foreground">Confirm Deletion</span>
            </AlertDialogTitle>
            <AlertDialogDescription>
              ยืนยันการลบ {deletingAnimal?.name}? ข้อมูลจะถูกลบถาวรและไม่สามารถกู้คืนได้
              <span className="block text-[11px] mt-0.5">Confirm deleting {deletingAnimal?.name}? This action cannot be undone.</span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>
              <div className="flex flex-col items-center leading-tight">
                <span>ยกเลิก</span>
                <span className="text-[9px] opacity-50">Cancel</span>
              </div>
            </AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteConfirm} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              <div className="flex flex-col items-center leading-tight">
                <span>ลบข้อมูล</span>
                <span className="text-[9px] opacity-70">Delete</span>
              </div>
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
