import { Link, useLocation } from "wouter";
import { Dna, LayoutDashboard, Heart, History, PawPrint } from "lucide-react";
import { ReactNode } from "react";

export function AppLayout({ children }: { children: ReactNode }) {
  const [location] = useLocation();

  const navItems = [
    { href: "/",          label: "แผงควบคุม",            sub: "Dashboard",            icon: LayoutDashboard },
    { href: "/animals",   label: "ข้อมูลสัตว์",           sub: "Animal Registry",      icon: PawPrint },
    { href: "/calculate", label: "จำลองการจับคู่ผสม",     sub: "Mating Simulation",    icon: Heart },
    { href: "/history",   label: "ประวัติการคำนวณ",       sub: "Calculation History",  icon: History },
  ];

  return (
    <div className="min-h-screen bg-background flex flex-col md:flex-row">
      <aside className="w-full md:w-64 bg-sidebar border-r border-sidebar-border flex-shrink-0 flex flex-col">
        <div className="p-6 border-b border-sidebar-border flex items-center gap-3">
          <div className="bg-primary text-primary-foreground p-2 rounded-lg">
            <Dna className="w-6 h-6" />
          </div>
          <div>
            <h1 className="font-bold text-lg text-sidebar-foreground leading-tight">Inbreeding Cal.</h1>
            <p className="text-[11px] text-sidebar-foreground/50">ระบบคำนวณอัตราเลือดชิด</p>
          </div>
        </div>
        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const active = location === item.href || (item.href !== "/" && location.startsWith(item.href));
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-md transition-colors ${
                  active
                    ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                    : "text-sidebar-foreground/80 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
                }`}
              >
                <item.icon className="w-5 h-5 shrink-0" />
                <div className="flex flex-col leading-tight">
                  <span className="text-sm">{item.label}</span>
                  <span className="text-[10px] opacity-50 font-normal">{item.sub}</span>
                </div>
              </Link>
            );
          })}
        </nav>
        <div className="p-4 border-t border-sidebar-border text-[10px] text-center text-sidebar-foreground/40">
          Inbreeding Cal. · Livestock Inbreeding System
        </div>
      </aside>

      <main className="flex-1 flex flex-col h-screen overflow-hidden">
        <div className="flex-1 overflow-y-auto p-4 md:p-8">
          <div className="max-w-6xl mx-auto">
            {children}
          </div>
        </div>
      </main>
    </div>
  );
}
