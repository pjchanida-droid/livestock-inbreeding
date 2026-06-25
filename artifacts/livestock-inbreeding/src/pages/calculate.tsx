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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Calculator, Dna, Info, Activity, ChevronsUpDown, Check, Sparkles } from "lucide-react";
import { RiskBadge } from "@/components/ui/risk-badge";
import { useEffect, useRef, useState } from "react";
import { PedigreeChart, PedigreeNode } from "@/components/ui/pedigree-chart";

const calculateSchema = z.object({
  sireId: z.string().min(1, "กรุณาเลือกพ่อพันธุ์"),
  damId: z.string().min(1, "กรุณาเลือกแม่พันธุ์"),
});

// ─── Reusable animal combobox with farm filter ─────────────────────
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
            <SelectItem key={f} value={f}>{f}</SelectItem>
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
                    onSelect={() => { onChange(a.id.toString()); setOpen(false); }}
                  >
                    <Check className={`mr-2 h-4 w-4 shrink-0 ${value === a.id.toString() ? "opacity-100" : "opacity-0"}`} />
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

// ─── Tab 1: Manual pairing ─────────────────────────────────────────
function ManualPairingTab() {
  const { data: animals } = useListAnimals();
  const { data: farms = [] } = useListFarms();
  const calculateMutation = useCalculateInbreeding();

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

  const males   = animals?.filter((a) => a.sex === "male")   || [];
  const females = animals?.filter((a) => a.sex === "female") || [];

  function onSubmit(values: z.infer<typeof calculateSchema>) {
    calculateMutation.mutate({
      data: { sireId: Number(values.sireId), damId: Number(values.damId) },
    });
  }

  const result = calculateMutation.data;
  const sireIdForPedigree = result?.sireId ?? 0;
  const damIdForPedigree  = result?.damId  ?? 0;
  const { data: sirePedigree } = useGetAnimalPedigree(sireIdForPedigree || 0);
  const { data: damPedigree  } = useGetAnimalPedigree(damIdForPedigree  || 0);

  const predictedPedigree: PedigreeNode | null = result
    ? {
        id: 0,
        name: "ลูกที่คาดการณ์",
        code: "EST",
        sex: "unknown",
        fCoefficient: result.fCoefficient,
        sire: sirePedigree as PedigreeNode,
        dam:  damPedigree  as PedigreeNode,
      }
    : null;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Left: form */}
      <Card className="lg:col-span-1 shadow-sm">
        <CardHeader>
          <CardTitle>
            <div className="flex flex-col leading-tight">
              <span>เลือกคู่ผสมพันธุ์</span>
              <span className="text-sm font-normal text-muted-foreground">Select Breeding Pair</span>
            </div>
          </CardTitle>
          <CardDescription>เลือกฟาร์มและค้นหาสัตว์โดยพิมพ์รหัสหรือชื่อ / Filter by farm, search by code or name</CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
              <FormField control={form.control} name="sireId" render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    <span>พ่อพันธุ์ (ตัวผู้) <span className="text-[10px] text-muted-foreground font-normal">/ Sire (Male)</span></span>
                  </FormLabel>
                  <AnimalCombobox value={field.value} onChange={field.onChange}
                    animals={males} placeholder="ค้นหาพ่อพันธุ์... / Search sire..." farms={farms} />
                  <FormMessage />
                </FormItem>
              )} />

              <FormField control={form.control} name="damId" render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    <span>แม่พันธุ์ (ตัวเมีย) <span className="text-[10px] text-muted-foreground font-normal">/ Dam (Female)</span></span>
                  </FormLabel>
                  <AnimalCombobox value={field.value} onChange={field.onChange}
                    animals={females} placeholder="ค้นหาแม่พันธุ์... / Search dam..." farms={farms} />
                  <FormMessage />
                </FormItem>
              )} />

              <Button type="submit" className="w-full" disabled={calculateMutation.isPending}>
                {calculateMutation.isPending ? "กำลังคำนวณ... / Calculating..." : (
                  <>
                    <Calculator className="w-4 h-4 mr-2" />
                    <div className="flex flex-col items-start leading-tight">
                      <span>ประเมินผล</span>
                      <span className="text-[9px] opacity-70">Evaluate</span>
                    </div>
                  </>
                )}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>

      {/* Right: result */}
      <div className="lg:col-span-2">
        {result ? (
          <Card className="border-primary/20 shadow-md">
            <CardHeader className="bg-primary/5 border-b border-primary/10 pb-4">
              <div className="flex justify-between items-start">
                <div>
                  <CardTitle className="text-2xl">
                    <div className="flex flex-col leading-tight">
                      <span>ผลการคำนวณ (F Coefficient)</span>
                      <span className="text-base font-normal text-muted-foreground">Inbreeding Calculation Result</span>
                    </div>
                  </CardTitle>
                  <CardDescription className="mt-1 text-base">
                    <span className="text-xs text-muted-foreground">พ่อ/Sire:</span>{" "}
                    <span className="font-semibold">{result.sireName}</span>{" "}
                    <span className="text-muted-foreground">×</span>{" "}
                    <span className="text-xs text-muted-foreground">แม่/Dam:</span>{" "}
                    <span className="font-semibold">{result.damName}</span>
                  </CardDescription>
                </div>
                <RiskBadge level={result.riskLevel} label={result.riskLabel} className="px-4 py-1 text-sm shadow-sm" />
              </div>
            </CardHeader>
            <CardContent className="pt-6 space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="bg-muted/20 rounded-lg p-4 border border-border">
                  <div className="flex flex-col leading-tight mb-1">
                    <span className="text-sm font-medium text-muted-foreground">ค่าเลือดชิดของพ่อพันธุ์เอง</span>
                    <span className="text-[10px] text-muted-foreground/50">Sire's Own Inbreeding (F)</span>
                  </div>
                  <div className="text-2xl font-bold">{result.fSirePercent?.toFixed(2)}%</div>
                  <div className="text-xs text-muted-foreground">F = {result.fSire?.toFixed(4)}</div>
                </div>
                <div className="bg-muted/20 rounded-lg p-4 border border-border">
                  <div className="flex flex-col leading-tight mb-1">
                    <span className="text-sm font-medium text-muted-foreground">ค่าเลือดชิดของแม่พันธุ์เอง</span>
                    <span className="text-[10px] text-muted-foreground/50">Dam's Own Inbreeding (F)</span>
                  </div>
                  <div className="text-2xl font-bold">{result.fDamPercent?.toFixed(2)}%</div>
                  <div className="text-xs text-muted-foreground">F = {result.fDam?.toFixed(4)}</div>
                </div>
                <div className="bg-muted/20 rounded-lg p-4 border border-border">
                  <div className="flex flex-col leading-tight mb-1">
                    <span className="text-sm font-medium text-muted-foreground">ค่าความสัมพันธ์ระหว่างคู่ผสม</span>
                    <span className="text-[10px] text-muted-foreground/50">Relatedness Coefficient (R)</span>
                  </div>
                  <div className="text-2xl font-bold text-secondary">{result.rPercent?.toFixed(2)}%</div>
                  <div className="text-xs text-muted-foreground">R = {result.rCoefficient?.toFixed(4)}</div>
                </div>
                <div className="bg-primary/10 rounded-lg p-4 border border-primary/20">
                  <div className="flex flex-col leading-tight mb-1">
                    <span className="text-sm font-medium text-primary">ค่าเลือดชิดของลูกที่คาดการณ์</span>
                    <span className="text-[10px] text-primary/50">Predicted Offspring Inbreeding (F)</span>
                  </div>
                  <div className="text-3xl font-black text-primary">{result.fPercent?.toFixed(2)}%</div>
                  <div className="text-xs text-primary/70">F = {result.fCoefficient?.toFixed(4)}</div>
                </div>
              </div>

              {predictedPedigree && (
                <div>
                  <h3 className="font-bold text-lg mb-3 flex items-center gap-2">
                    <Activity className="w-5 h-5 text-primary" />
                    <div className="flex flex-col leading-tight">
                      <span>แผนผังสายเลือดลูกที่คาดการณ์</span>
                      <span className="text-xs font-normal text-muted-foreground">Predicted Offspring Pedigree</span>
                    </div>
                  </h3>
                  <div className="overflow-x-auto bg-muted/10 rounded-lg p-4 border border-border">
                    <PedigreeChart node={predictedPedigree} />
                  </div>
                </div>
              )}

              {result.commonAncestors.length > 0 && (
                <div>
                  <h3 className="font-bold text-lg mb-3 flex items-center gap-2">
                    <Dna className="w-5 h-5 text-primary" />
                    <div className="flex flex-col leading-tight">
                      <span>บรรพบุรุษร่วม</span>
                      <span className="text-xs font-normal text-muted-foreground">Common Ancestors</span>
                    </div>
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {result.commonAncestors.map((ca, i) => (
                      <div key={i} className="flex justify-between items-center p-3 rounded-md bg-secondary/10 border border-secondary/20">
                        <div>
                          <div className="font-medium">{ca.name}</div>
                          <div className="text-xs text-muted-foreground">{ca.code}</div>
                        </div>
                        <div className="text-sm font-semibold">
                          <span className="text-muted-foreground text-xs">สมทบ/Contrib.:</span>{" "}
                          {(ca.contribution * 100).toFixed(2)}%
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {result.pathways.length > 0 && (
                <div>
                  <h3 className="font-bold text-lg mb-3 flex items-center gap-2">
                    <Activity className="w-5 h-5 text-primary" />
                    <div className="flex flex-col leading-tight">
                      <span>เส้นทางความสัมพันธ์</span>
                      <span className="text-xs font-normal text-muted-foreground">Relationship Pathways</span>
                    </div>
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
            <h3 className="text-xl font-bold mb-1">พร้อมสำหรับการประเมิน</h3>
            <p className="text-xs text-muted-foreground/60 mb-2">Ready for Evaluation</p>
            <p className="text-muted-foreground max-w-md">
              กรุณาเลือกพ่อพันธุ์และแม่พันธุ์จากแบบฟอร์มด้านซ้ายมือ แล้วกดปุ่ม "ประเมินผล"
              <span className="block text-xs text-muted-foreground/60 mt-1">
                Select a sire and dam from the form on the left, then click "Evaluate".
              </span>
            </p>
          </Card>
        )}
      </div>
    </div>
  );
}

// Extended type to include sireFarm returned by the API
type SireRec = {
  sireId: number;
  sireCode: string;
  sireName: string;
  sireFarm?: string | null;
  fCoefficient: number;
  rCoefficient: number;
  riskLevel: string;
  riskLabel: string;
};

// ─── Tab 2: Recommended pairing ────────────────────────────────────
function RecommendedPairingTab() {
  const { data: animals } = useListAnimals();
  const { data: farms = [] } = useListFarms();
  const recommendMutation = useRecommendSires();

  const [damFarmFilter, setDamFarmFilter] = useState<string>("all");
  const [sireFarmFilter, setSireFarmFilter] = useState<string>("all");
  const [damId, setDamId] = useState<string>("");
  const [open, setOpen] = useState(false);
  const prevDamId = useRef("");

  const females = (animals?.filter((a) => a.sex === "female") || []).filter(
    (a) => damFarmFilter === "all" || a.farm === damFarmFilter
  );
  const selectedDam = animals?.find((a) => a.id.toString() === damId);

  function handleEvaluate() {
    if (!damId) return;
    setSireFarmFilter("all");
    recommendMutation.mutate({ data: { damId: Number(damId), limit: 500 } });
    prevDamId.current = damId;
  }

  const allRecs = (recommendMutation.data ?? []) as SireRec[];

  // Unique farms from sires in result set
  const sireFarms = Array.from(
    new Set(allRecs.map((r) => r.sireFarm).filter((f): f is string => !!f))
  ).sort();

  const recs = sireFarmFilter === "all"
    ? allRecs
    : allRecs.filter((r) => r.sireFarm === sireFarmFilter);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Left: select dam */}
      <Card className="lg:col-span-1 shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-primary" />
            <div className="flex flex-col leading-tight">
              <span>เลือกแม่พันธุ์</span>
              <span className="text-sm font-normal text-muted-foreground">Select Dam</span>
            </div>
          </CardTitle>
          <CardDescription>เลือกตัวเมียที่ต้องการหาคู่ผสม ระบบจะแนะนำพ่อพันธุ์ที่ลดค่าเลือดชิดมากที่สุด
            <span className="block text-[11px] mt-0.5">Select a female — the system ranks sires that minimize offspring inbreeding.</span>
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Dam farm filter */}
          <div>
            <label className="text-sm font-medium mb-1 block">
              ฟาร์มแม่พันธุ์ <span className="text-[10px] text-muted-foreground font-normal">/ Dam Farm</span>
            </label>
            <Select value={damFarmFilter} onValueChange={(v) => { setDamFarmFilter(v); setDamId(""); }}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="ทุกฟาร์ม / All Farms" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">ทุกฟาร์ม / All Farms</SelectItem>
                {farms.map((f) => <SelectItem key={f} value={f}>{f}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          {/* Dam combobox */}
          <div>
            <label className="text-sm font-medium mb-1 block">
              แม่พันธุ์ (ตัวเมีย) <span className="text-[10px] text-muted-foreground font-normal">/ Dam (Female)</span>
            </label>
            <Popover open={open} onOpenChange={setOpen}>
              <PopoverTrigger asChild>
                <Button variant="outline" role="combobox" aria-expanded={open}
                  className="w-full justify-between text-left font-normal">
                  <span className="truncate">
                    {selectedDam
                      ? `${selectedDam.name} (${selectedDam.code})`
                      : <span className="text-muted-foreground">ค้นหาแม่พันธุ์...</span>}
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
                      {females.map((a) => (
                        <CommandItem key={a.id} value={`${a.code} ${a.name}`}
                          onSelect={() => { setDamId(a.id.toString()); setOpen(false); }}>
                          <Check className={`mr-2 h-4 w-4 shrink-0 ${damId === a.id.toString() ? "opacity-100" : "opacity-0"}`} />
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

          <Button className="w-full" disabled={!damId || recommendMutation.isPending} onClick={handleEvaluate}>
            {recommendMutation.isPending ? "กำลังประเมิน... / Evaluating..." : (
              <>
                <Sparkles className="w-4 h-4 mr-2" />
                <div className="flex flex-col items-start leading-tight">
                  <span>ประเมินผล</span>
                  <span className="text-[9px] opacity-70">Find Best Sires</span>
                </div>
              </>
            )}
          </Button>

          {selectedDam && (
            <div className="bg-muted/30 rounded-md p-3 text-sm border border-border">
              <div className="font-medium">{selectedDam.name}</div>
              <div className="text-muted-foreground text-xs">{selectedDam.code} · {selectedDam.farm || "-"}</div>
              {"fCoefficient" in selectedDam && selectedDam.fCoefficient != null && (
                <div className="text-xs mt-1">F ตัวเอง: <span className="font-semibold">{((selectedDam.fCoefficient as number) * 100).toFixed(2)}%</span></div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Right: results */}
      <div className="lg:col-span-2">
        {recommendMutation.isPending ? (
          <Card className="h-full flex flex-col items-center justify-center p-12 bg-muted/20 border-dashed">
            <Activity className="w-8 h-8 text-primary animate-spin mb-3" />
            <p className="text-muted-foreground">กำลังประเมินคู่ผสมทั้งหมด...</p>
          </Card>
        ) : recs.length > 0 ? (
          <Card className="shadow-sm">
            <CardHeader className="pb-3">
              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Sparkles className="w-5 h-5 text-primary" />
                    พ่อพันธุ์แนะนำสำหรับ {selectedDam?.name}
                  </CardTitle>
                  <CardDescription className="mt-1">
                    เรียงตามค่าเลือดชิดของลูกจากน้อยไปมาก · แสดง {recs.length} / {allRecs.length} รายการ
                  </CardDescription>
                </div>
                {sireFarms.length > 0 && (
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-sm font-medium text-muted-foreground whitespace-nowrap">ฟาร์มพ่อพันธุ์:</span>
                    <Select value={sireFarmFilter} onValueChange={setSireFarmFilter}>
                      <SelectTrigger className="w-[160px] h-8 text-sm">
                        <SelectValue placeholder="ทุกฟาร์ม" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">ทุกฟาร์ม</SelectItem>
                        {sireFarms.map((f) => (
                          <SelectItem key={f} value={f}>{f}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-muted/50 border-b border-border">
                      <th className="text-left px-4 py-3 font-semibold text-xs text-muted-foreground w-10">#</th>
                      <th className="text-left px-4 py-3 font-semibold text-xs text-muted-foreground"><div className="flex flex-col leading-tight"><span>รหัส</span><span className="text-[10px] opacity-50 font-normal">Code</span></div></th>
                      <th className="text-left px-4 py-3 font-semibold text-xs text-muted-foreground"><div className="flex flex-col leading-tight"><span>ชื่อพ่อพันธุ์</span><span className="text-[10px] opacity-50 font-normal">Sire Name</span></div></th>
                      <th className="text-left px-4 py-3 font-semibold text-xs text-muted-foreground"><div className="flex flex-col leading-tight"><span>ฟาร์ม</span><span className="text-[10px] opacity-50 font-normal">Farm</span></div></th>
                      <th className="text-center px-4 py-3 font-semibold text-xs text-muted-foreground"><div className="flex flex-col items-center leading-tight"><span>F ลูก (%)</span><span className="text-[10px] opacity-50 font-normal">Offspring F</span></div></th>
                      <th className="text-center px-4 py-3 font-semibold text-xs text-muted-foreground"><div className="flex flex-col items-center leading-tight"><span>R (%)</span><span className="text-[10px] opacity-50 font-normal">Relatedness</span></div></th>
                      <th className="text-right px-4 py-3 font-semibold text-xs text-muted-foreground"><div className="flex flex-col items-end leading-tight"><span>ความเสี่ยง</span><span className="text-[10px] opacity-50 font-normal">Risk Level</span></div></th>
                    </tr>
                  </thead>
                  <tbody>
                    {recs.map((rec, idx) => (
                      <tr key={rec.sireId}
                        className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                        <td className="px-4 py-3 text-muted-foreground font-mono text-xs">{idx + 1}</td>
                        <td className="px-4 py-3 font-semibold">{rec.sireCode}</td>
                        <td className="px-4 py-3 text-muted-foreground">{rec.sireName}</td>
                        <td className="px-4 py-3 text-muted-foreground text-xs">{rec.sireFarm ?? "—"}</td>
                        <td className="px-4 py-3 text-center">
                          <span className={`font-bold ${rec.fCoefficient === 0 ? "text-green-600" : rec.fCoefficient > 0.125 ? "text-red-600" : "text-orange-500"}`}>
                            {(rec.fCoefficient * 100).toFixed(2)}%
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center text-muted-foreground text-xs">
                          {(rec.rCoefficient * 100).toFixed(2)}%
                        </td>
                        <td className="px-4 py-3 text-right">
                          <RiskBadge level={rec.riskLevel} label={rec.riskLabel} className="text-xs px-2 py-0.5" />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        ) : recommendMutation.isSuccess ? (
          <Card className="h-full flex flex-col items-center justify-center p-12 bg-muted/20 border-dashed">
            <p className="text-muted-foreground">ไม่พบพ่อพันธุ์ที่เหมาะสม</p>
          </Card>
        ) : (
          <Card className="h-full flex flex-col items-center justify-center text-center p-12 bg-muted/20 border-dashed">
            <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mb-4">
              <Sparkles className="w-8 h-8 text-muted-foreground" />
            </div>
            <h3 className="text-xl font-bold mb-2">คู่ผสมที่แนะนำ</h3>
            <p className="text-muted-foreground max-w-md">
              เลือกแม่พันธุ์จากแบบฟอร์มด้านซ้าย แล้วกด "ประเมินผล"
              ระบบจะแสดงพ่อพันธุ์ทั้งหมดพร้อมค่าเลือดชิดที่คาดการณ์ เรียงจากน้อยไปมาก
            </p>
          </Card>
        )}
      </div>
    </div>
  );
}

// ─── Page ───────────────────────────────────────────────────────────
export default function Calculate() {
  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div>
        <h1 className="text-3xl font-bold text-foreground">จำลองการจับคู่ผสม</h1>
        <p className="text-muted-foreground mt-1">
          วิเคราะห์ความสัมพันธ์ทางพันธุกรรมและคาดการณ์ผลลัพธ์ก่อนผสมพันธุ์จริง{" "}
          <span className="text-xs opacity-60">/ Genetic Analysis & Mating Simulation</span>
        </p>
      </div>

      <Tabs defaultValue="manual">
        <TabsList className="mb-4">
          <TabsTrigger value="manual" className="flex items-center gap-2">
            <Calculator className="w-4 h-4" />
            <div className="flex flex-col items-start leading-tight">
              <span>จับคู่ผสมเอง</span>
              <span className="text-[9px] opacity-60">Manual Pairing</span>
            </div>
          </TabsTrigger>
          <TabsTrigger value="recommend" className="flex items-center gap-2">
            <Sparkles className="w-4 h-4" />
            <div className="flex flex-col items-start leading-tight">
              <span>คู่ผสมที่แนะนำ</span>
              <span className="text-[9px] opacity-60">Recommended Pairing</span>
            </div>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="manual">
          <ManualPairingTab />
        </TabsContent>

        <TabsContent value="recommend">
          <RecommendedPairingTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
