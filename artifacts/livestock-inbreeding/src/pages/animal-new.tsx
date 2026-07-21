import { useListAnimals, useCreateAnimal } from "@workspace/api-client-react";
import { Link, useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { getListAnimalsQueryKey } from "@workspace/api-client-react";

const animalSchema = z.object({
  name:      z.string().min(1, "กรุณาระบุชื่อ / Status"),
  code:      z.string().min(1, "กรุณาระบุรหัส"),
  species:   z.string().min(1, "กรุณาระบุสายพันธุ์"),
  sex:       z.enum(["male", "female"], { required_error: "กรุณาระบุเพศ" }),
  farm:      z.string().optional(),
  birthDate: z.string().optional(),
  notes:     z.string().optional(),
  isActive:  z.boolean().default(true),
  sireId:    z.string().transform(val => val && val !== "none" ? Number(val) : null).optional(),
  damId:     z.string().transform(val => val && val !== "none" ? Number(val) : null).optional(),
});

export default function AnimalNew() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: animals } = useListAnimals();
  const createAnimal = useCreateAnimal();

  const form = useForm<z.infer<typeof animalSchema>>({
    resolver: zodResolver(animalSchema),
    defaultValues: {
      name: "", code: "", species: "", farm: "", notes: "", birthDate: "", isActive: true
    }
  });

  const males   = animals?.filter(a => a.sex === "male")   || [];
  const females = animals?.filter(a => a.sex === "female") || [];

  function onSubmit(values: z.infer<typeof animalSchema>) {
    createAnimal.mutate({ data: values }, {
      onSuccess: () => {
        toast({ title: "บันทึกข้อมูลสำเร็จ", description: "เพิ่มข้อมูลสัตว์ใหม่ลงในระบบแล้ว" });
        queryClient.invalidateQueries({ queryKey: getListAnimalsQueryKey() });
        setLocation("/animals");
      },
      onError: () => {
        toast({ title: "เกิดข้อผิดพลาด", description: "ไม่สามารถบันทึกข้อมูลได้", variant: "destructive" });
      }
    });
  }

  return (
    <div className="space-y-6 max-w-2xl mx-auto animate-in fade-in duration-500">
      <div className="flex items-center gap-4">
        <Button variant="outline" size="icon" asChild>
          <Link href="/animals"><ArrowLeft className="w-4 h-4" /></Link>
        </Button>
        <div>
          <h1 className="text-3xl font-bold text-foreground">เพิ่มข้อมูลสัตว์</h1>
          <p className="text-muted-foreground mt-1">ลงทะเบียนประวัติสัตว์ใหม่ — ตรงตาม template Excel</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>ข้อมูลพื้นฐาน <span className="text-xs font-normal text-muted-foreground">(ตรงกับคอลัมน์ template)</span></CardTitle>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">

              {/* Row 1: Animal_ID + Farm */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField control={form.control} name="code" render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      รหัสประจำตัว
                      <span className="ml-1 text-[10px] text-muted-foreground font-normal">Animal_ID</span>
                    </FormLabel>
                    <FormControl><Input {...field} placeholder="เช่น C001" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="farm" render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      ฟาร์ม
                      <span className="ml-1 text-[10px] text-muted-foreground font-normal">Farm</span>
                    </FormLabel>
                    <FormControl><Input {...field} placeholder="ระบุชื่อฟาร์ม" value={field.value || ""} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>

              {/* Row 2: Sex + Species */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField control={form.control} name="sex" render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      เพศ
                      <span className="ml-1 text-[10px] text-muted-foreground font-normal">Sex (M/F)</span>
                    </FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger><SelectValue placeholder="เลือกเพศ" /></SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="male">ตัวผู้ (M)</SelectItem>
                        <SelectItem value="female">ตัวเมีย (F)</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="species" render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      สายพันธุ์
                      <span className="ml-1 text-[10px] text-muted-foreground font-normal">Species</span>
                    </FormLabel>
                    <FormControl><Input {...field} placeholder="เช่น กระบือ, โคเนื้อ" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>

              {/* Row 3: Status (name) + Active (isActive) */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField control={form.control} name="name" render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      สถานะ / ชื่อเรียก
                      <span className="ml-1 text-[10px] text-muted-foreground font-normal">Status</span>
                    </FormLabel>
                    <FormControl><Input {...field} placeholder="เช่น พ่อพันธุ์, แม่พันธุ์, ลูกผสม" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="isActive" render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      สถานะการใช้งาน
                      <span className="ml-1 text-[10px] text-muted-foreground font-normal">Active</span>
                    </FormLabel>
                    <Select
                      onValueChange={v => field.onChange(v === "true")}
                      value={field.value === false ? "false" : "true"}
                    >
                      <FormControl>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="true">อยู่ในระบบ</SelectItem>
                        <SelectItem value="false">ไม่อยู่ในระบบ</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>

              {/* Sire / Dam */}
              <div className="pt-4 border-t border-border">
                <h3 className="font-medium text-lg mb-4">
                  สายเลือด
                  <span className="ml-2 text-sm font-normal text-muted-foreground">Sire_ID / Dam_ID</span>
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField control={form.control} name="sireId" render={({ field }) => (
                    <FormItem>
                      <FormLabel>พ่อพันธุ์ <span className="text-[10px] text-muted-foreground font-normal">Sire_ID</span></FormLabel>
                      <Select onValueChange={field.onChange} value={field.value?.toString() || ""}>
                        <FormControl>
                          <SelectTrigger><SelectValue placeholder="เลือกพ่อพันธุ์" /></SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="none" className="text-muted-foreground italic">ไม่ระบุ (Unknown)</SelectItem>
                          {males.map(m => (
                            <SelectItem key={m.id} value={m.id.toString()}>{m.name} ({m.code})</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="damId" render={({ field }) => (
                    <FormItem>
                      <FormLabel>แม่พันธุ์ <span className="text-[10px] text-muted-foreground font-normal">Dam_ID</span></FormLabel>
                      <Select onValueChange={field.onChange} value={field.value?.toString() || ""}>
                        <FormControl>
                          <SelectTrigger><SelectValue placeholder="เลือกแม่พันธุ์" /></SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="none" className="text-muted-foreground italic">ไม่ระบุ (Unknown)</SelectItem>
                          {females.map(f => (
                            <SelectItem key={f.id} value={f.id.toString()}>{f.name} ({f.code})</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )} />
                </div>
              </div>

              {/* Optional fields */}
              <div className="pt-4 border-t border-border">
                <h3 className="font-medium text-lg mb-4">ข้อมูลเพิ่มเติม (ไม่บังคับ)</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField control={form.control} name="birthDate" render={({ field }) => (
                    <FormItem>
                      <FormLabel>วันเกิด</FormLabel>
                      <FormControl><Input type="date" {...field} value={field.value || ""} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                </div>
                <div className="mt-4">
                  <FormField control={form.control} name="notes" render={({ field }) => (
                    <FormItem>
                      <FormLabel>หมายเหตุ</FormLabel>
                      <FormControl><Textarea {...field} rows={3} placeholder="บันทึกข้อมูลเพิ่มเติม..." /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                </div>
              </div>

              <div className="pt-4 flex justify-end gap-3">
                <Button variant="outline" type="button" asChild>
                  <Link href="/animals">ยกเลิก</Link>
                </Button>
                <Button type="submit" disabled={createAnimal.isPending}>
                  {createAnimal.isPending ? "กำลังบันทึก..." : "บันทึกข้อมูล"}
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
