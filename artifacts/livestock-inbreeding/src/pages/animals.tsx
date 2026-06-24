import { useListAnimals } from "@workspace/api-client-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Search } from "lucide-react";
import { useState } from "react";
import { Skeleton } from "@/components/ui/skeleton";

export default function Animals() {
  const { data: animals, isLoading } = useListAnimals();
  const [search, setSearch] = useState("");

  const filteredAnimals = animals?.filter(a => 
    a.name.toLowerCase().includes(search.toLowerCase()) || 
    a.code.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground">ทะเบียนสัตว์</h1>
          <p className="text-muted-foreground mt-1">จัดการข้อมูลสัตว์ในฟาร์มทั้งหมด</p>
        </div>
        <Button asChild className="shrink-0 bg-primary text-primary-foreground">
          <Link href="/animals/new" className="flex items-center gap-2">
            <Plus className="w-4 h-4" />
            เพิ่มข้อมูลสัตว์
          </Link>
        </Button>
      </div>

      <Card>
        <div className="p-4 border-b border-border flex items-center gap-3">
          <Search className="w-5 h-5 text-muted-foreground" />
          <Input 
            placeholder="ค้นหาชื่อ หรือ รหัสสัตว์..." 
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="max-w-sm border-0 focus-visible:ring-0 px-0"
          />
        </div>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50 hover:bg-muted/50">
                <TableHead>รหัส</TableHead>
                <TableHead>ชื่อสัตว์</TableHead>
                <TableHead>สายพันธุ์</TableHead>
                <TableHead>เพศ</TableHead>
                <TableHead>สายเลือด (พ่อ / แม่)</TableHead>
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
                    <TableCell><Skeleton className="h-8 w-20 ml-auto" /></TableCell>
                  </TableRow>
                ))
              ) : filteredAnimals?.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-32 text-center text-muted-foreground">
                    ไม่พบข้อมูลสัตว์
                  </TableCell>
                </TableRow>
              ) : (
                filteredAnimals?.map((animal) => (
                  <TableRow key={animal.id} className="hover:bg-muted/30">
                    <TableCell className="font-medium">{animal.code}</TableCell>
                    <TableCell>{animal.name}</TableCell>
                    <TableCell>{animal.species}</TableCell>
                    <TableCell>{animal.sex === 'male' ? 'ผู้' : 'เมีย'}</TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {animal.sireName || '-'} / {animal.damName || '-'}
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
