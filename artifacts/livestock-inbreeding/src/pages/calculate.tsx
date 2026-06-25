import {
  useListAnimals,
  useListFarms,
  useCalculateInbreeding,
  useRecommendSires,
  useGetAnimalPedigree,
} from "@workspace/api-client-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Calculator, Dna, Info, Activity, ChevronsUpDown, Check } from "lucide-react";
import { RiskBadge } from "@/components/ui/risk-badge";
import { useEffect, useRef, useState } from "react";
import { PedigreeChart, PedigreeNode } from "@/components/ui/pedigree-chart";

const calculateSchema = z.object({
  sireId: z.string().min(1, "กรุณาเลือกพ่อพันธุ์"),
  damId: z.string().min(1, "กรุณาเลือกแม่พันธุ์"),
});

function AnimalCombobox({
  value,
  onChange,
  animals,
  placeholder,
  farms,
}: {
  value: string;
  onChange: (v: string) => void;
  animals: Array<{ id: number; name: string; code: string; farm?: string | null }>;
  placeholder: string;
  farms: string[];
}) {
  const [open, setOpen] = useState(false);
  const [farmFilter, setFarmFilter] = useState<string>("all");

  const filtered = animals.filter(
    (a) => farmFilter === "all" || a.farm === farmFilter
  );

  const selected = animals.find((a) => a.id.toString() === value);

  return (
    <div className="space-y-2">
      <Select value={farmFilter} onValueChange={setFarmFilter}>
        <SelectTrigger className="w-full h-8 text-xs">
          <SelectValue placeholder="ทุกฟาร์ม" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">ทุกฟาร์ม</SelectItem>
          {farms.map((f) => (
            <SelectItem key={f} value={f}>
              {f}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="w-full justify-between text-left font-normal"
          >
            <span className="truncate">
              {selected
                ? `${selected.name} (${selected.code})`
                : <span className="text-muted-foreground">{placeholder}</span>}
            </span>
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[300px] p-0" align="start">
          <Command>
            <CommandInput placeholder="พิมพ์เพื่อค้นหา รหัส / ชื่อ..." />
            <CommandList>
              <CommandEmpty>ไม่พบสัตว์</CommandEmpty>
              <CommandGroup>
                {filtered.map((a) => (
                  <CommandItem
                    key={a.id}
                    value={`${a.code} ${a.name}`}
                    onSelect={() => {
                      onChange(a.id.toString());
                      setOpen(false);
                    }}
                  >
                    <Check
                      className={`mr-2 h-4 w-4 shrink-0 ${
                        value === a.id.toString() ? "opacity-100" : "opacity-0"
                      }`}
                    />
                    <div className="flex flex-col">
                      <span className="font-medium">{a.name}</span>
                      <span className="text-xs text-muted-foreground">
                        {a.code}{a.farm ? ` · ${a.farm}` : ""}
                      </span>
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
}

export default function Calculate() {
  const { data: animals } = useListAnimals();
  const { data: farms = [] } = useListFarms();
  const calculateMutation = useCalculateInbreeding();
  const recommendMutation = useRecommendSires();

  const form = useForm<z.infer<typeof calculateSchema>>({
    resolver: zodResolver(calculateSchema),
    defaultValues: { sireId: "", damId: "" },
  });

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const sId = params.get("sireId");
    const dId = params.get("damId");
    if (sId) form.setValue("sireId", sId);
    if (dId) form.setValue("damId", dId);
  }, [form]);

  const damIdWatch = form.watch("damId");
  const prevDamId = useRef(damIdWatch);

  useEffect(() => {
    if (damIdWatch && damIdWatch !== prevDamId.current) {
      prevDamId.current = damIdWatch;
      recommendMutation.mutate({ data: { damId: Number(damIdWatch), limit: 10 } });
    }
  }, [damIdWatch, recommendMutation]);

  const males = animals?.filter((a) => a.sex === "male") || [];
  const females = animals?.filter((a) => a.sex === "female") || [];

  function onSubmit(values: z.infer<typeof calculateSchema>) {
    calculateMutation.mutate({
      data: { sireId: Number(values.sireId), damId: Number(values.damId) },
    });
  }

  const result = calculateMutation.data;

  const sireIdForPedigree = result?.sireId ?? 0;
  const damIdForPedigree = result?.damId ?? 0;

  const { data: sirePedigree } = useGetAnimalPedigree(sireIdForPedigree || 0);
  const { data: damPedigree } = useGetAnimalPedigree(damIdForPedigree || 0);

  const predictedPedigree: PedigreeNode | null = result
    ? {
        id: 0,
        name: "ลูกที่คาดการณ์",
        code: "EST",
        sex: "unknown",
        fCoefficient: result.fCoefficient,
        sire: sirePedigree as PedigreeNode,
        dam: damPedigree as PedigreeNode,
      }
    : null;

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div>
        <h1 className="text-3xl font-bold text-foreground">จำลองการจับคู่ผสม</h1>
        <p className="text-muted-foreground mt-1">
          วิเคราะห์ความสัมพันธ์ทางพันธุกรรมและคาดการณ์ผลลัพธ์ก่อนผสมพันธุ์จริง
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-1 shadow-sm">
          <CardHeader>
            <CardTitle>เลือกคู่ผสมพันธุ์</CardTitle>
            <CardDescription>เลือกฟาร์มและค้นหาสัตว์โดยพิมพ์รหัสหรือชื่อ</CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
                <FormField
                  control={form.control}
                  name="sireId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>พ่อพันธุ์ (ตัวผู้)</FormLabel>
                      <AnimalCombobox
                        value={field.value}
                        onChange={field.onChange}
                        animals={males}
                        placeholder="ค้นหาพ่อพันธุ์..."
                        farms={farms}
                      />
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="damId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>แม่พันธุ์ (ตัวเมีย)</FormLabel>
                      <AnimalCombobox
                        value={field.value}
                        onChange={field.onChange}
                        animals={females}
                        placeholder="ค้นหาแม่พันธุ์..."
                        farms={farms}
                      />
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <Button
                  type="submit"
                  className="w-full"
                  disabled={calculateMutation.isPending}
                >
                  {calculateMutation.isPending ? (
                    "กำลังคำนวณ..."
                  ) : (
                    <>
                      <Calculator className="w-4 h-4 mr-2" /> ประเมินผล
                    </>
                  )}
                </Button>
              </form>
            </Form>

            {damIdWatch && (
              <div className="mt-8 pt-6 border-t border-border">
                <h3 className="text-sm font-semibold mb-3 text-foreground">
                  พ่อพันธุ์แนะนำ (เรียงตามค่าเลือดชิดต่ำสุด)
                </h3>
                {recommendMutation.isPending ? (
                  <div className="text-sm text-muted-foreground text-center py-6 flex flex-col items-center">
                    <Activity className="w-5 h-5 animate-spin mb-2" />
                    กำลังประมวลผล...
                  </div>
                ) : recommendMutation.data && recommendMutation.data.length > 0 ? (
                  <div className="space-y-2">
                    <div className="grid grid-cols-12 gap-2 text-[11px] font-semibold text-muted-foreground pb-2 border-b">
                      <div className="col-span-2 text-center">อันดับ</div>
                      <div className="col-span-5">รหัส / ชื่อ</div>
                      <div className="col-span-2 text-center">F ลูก (%)</div>
                      <div className="col-span-3 text-right pr-1">ความเสี่ยง</div>
                    </div>
                    {recommendMutation.data.slice(0, 8).map((rec, idx) => (
                      <div
                        key={rec.sireId}
                        className="grid grid-cols-12 gap-2 items-center text-sm p-2 rounded-md hover:bg-muted/60 cursor-pointer transition-colors border border-transparent hover:border-border/50"
                        onClick={() => form.setValue("sireId", rec.sireId.toString())}
                      >
                        <div className="col-span-2 font-mono text-center text-muted-foreground">
                          #{idx + 1}
                        </div>
                        <div className="col-span-5 truncate">
                          <div className="font-semibold">{rec.sireCode}</div>
                          <div className="text-[10px] text-muted-foreground truncate">{rec.sireName}</div>
                        </div>
                        <div className="col-span-2 text-center font-medium">
                          {(rec.fCoefficient * 100).toFixed(1)}
                        </div>
                        <div className="col-span-3 flex justify-end">
                          <RiskBadge
                            level={rec.riskLevel}
                            label={rec.riskLabel}
                            className="text-[10px] px-1.5 py-0 h-5"
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-sm text-muted-foreground text-center py-6 bg-muted/20 rounded-md border border-dashed">
                    ไม่พบพ่อพันธุ์แนะนำ
                  </div>
                )}
              </div>
            )}
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
                      พ่อ: <span className="font-semibold">{result.sireName}</span> × แม่:{" "}
                      <span className="font-semibold">{result.damName}</span>
                    </CardDescription>
                  </div>
                  <RiskBadge
                    level={result.riskLevel}
                    label={result.riskLabel}
                    className="px-4 py-1 text-sm shadow-sm"
                  />
                </div>
              </CardHeader>
              <CardContent className="pt-6 space-y-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="bg-muted/20 rounded-lg p-4 border border-border">
                    <div className="text-sm font-medium text-muted-foreground mb-1">
                      ค่าเลือดชิดของพ่อพันธุ์เอง
                    </div>
                    <div className="text-2xl font-bold">{result.fSirePercent?.toFixed(2)}%</div>
                    <div className="text-xs text-muted-foreground">F = {result.fSire?.toFixed(4)}</div>
                  </div>
                  <div className="bg-muted/20 rounded-lg p-4 border border-border">
                    <div className="text-sm font-medium text-muted-foreground mb-1">
                      ค่าเลือดชิดของแม่พันธุ์เอง
                    </div>
                    <div className="text-2xl font-bold">{result.fDamPercent?.toFixed(2)}%</div>
                    <div className="text-xs text-muted-foreground">F = {result.fDam?.toFixed(4)}</div>
                  </div>
                  <div className="bg-muted/20 rounded-lg p-4 border border-border">
                    <div className="text-sm font-medium text-muted-foreground mb-1">
                      ค่าความสัมพันธ์ระหว่างคู่ผสม (R)
                    </div>
                    <div className="text-2xl font-bold text-secondary">{result.rPercent?.toFixed(2)}%</div>
                    <div className="text-xs text-muted-foreground">R = {result.rCoefficient?.toFixed(4)}</div>
                  </div>
                  <div className="bg-primary/10 rounded-lg p-4 border border-primary/20">
                    <div className="text-sm font-medium text-primary mb-1">
                      ค่าเลือดชิดของลูกที่คาดการณ์ (F)
                    </div>
                    <div className="text-3xl font-black text-primary">{result.fPercent?.toFixed(2)}%</div>
                    <div className="text-xs text-primary/70">F = {result.fCoefficient?.toFixed(4)}</div>
                  </div>
                </div>

                {predictedPedigree && (
                  <div>
                    <h3 className="font-bold text-lg mb-3 flex items-center gap-2">
                      <Activity className="w-5 h-5 text-primary" /> แผนผังสายเลือดลูกที่คาดการณ์
                    </h3>
                    <div className="overflow-x-auto bg-muted/10 rounded-lg p-4 border border-border">
                      <PedigreeChart node={predictedPedigree} />
                    </div>
                  </div>
                )}

                {result.commonAncestors.length > 0 && (
                  <div>
                    <h3 className="font-bold text-lg mb-3 flex items-center gap-2">
                      <Dna className="w-5 h-5 text-primary" /> บรรพบุรุษร่วม (Common Ancestors)
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {result.commonAncestors.map((ca, i) => (
                        <div
                          key={i}
                          className="flex justify-between items-center p-3 rounded-md bg-secondary/10 border border-secondary/20"
                        >
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
                    <h3 className="font-bold text-lg mb-3 flex items-center gap-2">
                      <Activity className="w-5 h-5 text-primary" /> เส้นทางความสัมพันธ์ (Pathways)
                    </h3>
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
                กรุณาเลือกพ่อพันธุ์และแม่พันธุ์จากแบบฟอร์มด้านซ้ายมือ แล้วกดปุ่ม "ประเมินผล"
                ระบบจะคำนวณอัตราเลือดชิดและประเมินระดับความเสี่ยงให้ทันที
              </p>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
