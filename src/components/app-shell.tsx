import { Link, useRouterState } from "@tanstack/react-router";
import { Home, Users, Package, Receipt, User } from "lucide-react";
import type { ReactNode } from "react";

const TABS = [
  { to: "/dashboard", label: "Inicio", icon: Home },
  { to: "/history", label: "Facturas", icon: Receipt },
  { to: "/clients", label: "Clientes", icon: Users },
  { to: "/products", label: "Productos", icon: Package },
  { to: "/profile", label: "Perfil", icon: User },
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  return (
    <div className="app-shell pb-24">
      {children}
      <nav className="fixed inset-x-0 bottom-0 z-40 mx-auto max-w-[430px] border-t border-border bg-surface/85 backdrop-blur-xl">
        <div className="flex items-center justify-around px-2 pt-2 pb-[max(env(safe-area-inset-bottom),0.75rem)]">
          {TABS.map(({ to, label, icon: Icon }) => {
            const active = pathname === to || pathname.startsWith(to + "/");
            return (
              <Link
                key={to}
                to={to}
                className={`flex flex-1 flex-col items-center gap-1 rounded-xl px-2 py-1.5 text-[10px] font-semibold tracking-tight transition ${
                  active ? "text-primary" : "text-muted-foreground"
                }`}
              >
                <Icon className="size-[22px]" strokeWidth={active ? 2.4 : 1.8} />
                <span>{label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
