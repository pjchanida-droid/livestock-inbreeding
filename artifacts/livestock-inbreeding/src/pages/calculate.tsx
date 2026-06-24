import { useListAnimals, useCalculateInbreeding } from "@workspace/api-client-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Calculator, Dna, Info } from "lucide-react";
import { RiskBadge } from "@/components/ui/risk-badge";
import { useLocation } from "wouter";
import { useEffect } from "react";

const calculateSchema = z.object({
  sireId: z.string().min(1, "กรุณาเลือกพ่อพันธุ์"),
  damId: z.string().min(1, "กรุณาเลือกแม่พันธุ์"),
});

export default function Calculate() {
  const { data: animals } = useListAnimals();
  const calculateMutation = useCalculateInbreeding();
  const [location] = useLocation();

  const form = useForm<z.infer<typeof calculateSchema>>({
    resolver: zodResolver(calculateSchema),
    defaultValues: { sireId: "", damId: "" }
  });

  // Pre-fill from URL params if present
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const sId = params.get('sireId');
    const dId = params.get('damId');
    if (sId) form.setValue('sireId', sId);
    if (dId) form.setValue('damId', dId);
  }, [form]);

  const males = animals?.filter(a => a.sex === "male") || [];
  const females = animals?.filter(a => a.sex === "female") || [];

  function onSubmit(values: z.infer<typeof calculateSchema>) {
    calculateMutation.mutate({ 
      data: { sireId: Number(values.sireId), damId: Number(values.damId) } 
    });
  }

  const result = calculateMutation.data;

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div>
        <h1 className="text-3xl font-bold text-foreground">คำนวณอัตราเลือดชิด</h1>
        <p className="text-muted-foreground mt-1">ประเมินความเสี่ยงในการผสมพันธุ์เพื่อป้องกันความอ่อนแอทางพันธุกรรม</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-1 shadow-sm">
          <CardHeader>
            <CardTitle>เลือกคู่ผสมพันธุ์</CardTitle>
            <CardDescription>เลือกระบุพ่อพันธุ์และแม่พันธุ์ที่ต้องการตรวจสอบ</CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <FormField control={form.control} name="sireId" render={({ field }) => (
                  <FormItem>
                    <FormLabel>พ่อพันธุ์ (ตัวผู้)</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger><SelectValue placeholder="ค้นหาหรือเลือกพ่อพันธุ์" /></SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {males.map(m => <SelectItem key={m.id} value={m.id.toString()}>{m.name} ({m.code})</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />

                <FormField control={form.control} name="damId" render={({ field }) => (
                  <FormItem>
                    <FormLabel>แม่พันธุ์ (ตัวเมีย)</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger><SelectValue placeholder="ค้นหาหรือเลือกแม่พันธุ์" /></SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {females.map(f => <SelectItem key={f.id} value={f.id.toString()}>{f.name} ({f.code})</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />

                <Button type="submit" className="w-full" disabled={calculateMutation.isPending}>
                  {calculateMutation.isPending ? "กำลังคำนวณ..." : <><Calculator className="w-4 h-4 mr-2" /> ประเมินผล</>}
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>

        <div className="lg:col-span-2">
          {result ? (
            <Card className="border-primary/20 shadow-md bg-card">
              <CardHeader className="bg-primary/5 border-b border-primary/10 pb-4">
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle className="text-2xl">ผลการคำนวณ (F Coefficient)</CardTitle>
                    <CardDescription className="mt-1 text-base">
                      พ่อ: <span className="font-semibold">{result.sireName}</span> × แม่: <span className="font-semibold">{result.damName}</span>
                    </CardDescription>
                  </div>
                  <RiskBadge level={result.riskLevel} label={result.riskLabel} className="px-4 py-1 text-sm shadow-sm" />
                </div>
              </CardHeader>
              <CardContent className="pt-6 space-y-6">
                <div className="flex flex-col items-center justify-center p-8 bg-muted/30 rounded-xl border border-border/50">
                  <div className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-2">Wright's Inbreeding Coefficient</div>
                  <div className="text-6xl font-black tabular-nums tracking-tight mb-2">
                    {result.fPercent?.toFixed(2)}%
                  </div>
                  <div className="text-sm text-muted-foreground">F = {result.fCoefficient.toFixed(4)}</div>
                </div>

                {result.commonAncestors.length > 0 && (
                  <div>
                    <h3 className="font-bold text-lg mb-3 flex items-center gap-2">
                      <Dna className="w-5 h-5 text-primary" /> บรรพบุรุษร่วม (Common Ancestors)
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {result.commonAncestors.map((ca, i) => (
                        <div key={i} className="flex justify-between items-center p-3 rounded-md bg-secondary/10 border border-secondary/20">
                          <div>
                            <div className="font-medium">{ca.name}</div>
                            <div className="text-xs text-muted-foreground">{ca.code}</div>
                          </div>
                          <div className="text-sm font-semibold">
                            สมทบ: {(ca.contribution * 100).toFixed(2)}%
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                
                {result.pathways.length > 0 && (
                  <div>
                    <h3 className="font-bold text-lg mb-3">เส้นทางความสัมพันธ์ (Pathways)</h3>
                    <div className="space-y-2 font-mono text-sm bg-slate-900 text-slate-200 p-4 rounded-lg overflow-x-auto">
                      {result.pathways.map((path, idx) => (
                        <div key={idx}>{path}</div>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          ) : (
            <Card className="h-full flex flex-col items-center justify-center text-center p-12 bg-muted/20 border-dashed">
              <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mb-4">
                <Info className="w-8 h-8 text-muted-foreground" />
              </div>
              <h3 className="text-xl font-bold mb-2">พร้อมสำหรับการประเมิน</h3>
              <p className="text-muted-foreground max-w-md">
                กรุณาเลือกพ่อพันธุ์และแม่พันธุ์จากแบบฟอร์มด้านซ้ายมือ แล้วกดปุ่ม "ประเมินผล" ระบบจะคำนวณอัตราเลือดชิดและประเมินระดับความเสี่ยงให้ทันที
              </p>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
