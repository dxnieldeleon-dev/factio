import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, Sparkles, ShieldCheck, Zap } from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Factura Fácil — Facturación CFDI 4.0 en menos de 60 segundos" },
      { name: "description", content: "La forma más sencilla de emitir facturas electrónicas en México. Para freelancers, profesionistas y pequeñas empresas." },
      { property: "og:title", content: "Factura Fácil" },
      { property: "og:description", content: "Factura CFDI 4.0 desde tu celular en menos de 60 segundos." },
    ],
  }),
  component: Landing,
});

function Landing() {
  return (
    <div className="min-h-dvh bg-background text-foreground">
      <header className="mx-auto flex max-w-5xl items-center justify-between px-5 pt-8">
        <div className="flex items-center gap-2">
          <div className="grid size-8 place-items-center rounded-xl bg-foreground text-background font-bold">F</div>
          <span className="font-semibold tracking-tight">Factura Fácil</span>
        </div>
        <Link
          to="/auth"
          className="rounded-full border border-border bg-surface px-4 py-2 text-sm font-medium hover:bg-accent transition"
        >
          Iniciar sesión
        </Link>
      </header>

      <main className="mx-auto max-w-5xl px-5 pt-16 pb-24">
        <div className="animate-reveal max-w-3xl">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-primary-soft px-3 py-1 text-xs font-semibold text-primary">
            <Sparkles className="size-3.5" />
            Hecho para México · CFDI 4.0
          </span>
          <h1 className="mt-5 text-4xl font-bold tracking-tight sm:text-6xl">
            Factura en menos de <span className="text-primary">60 segundos</span>.
          </h1>
          <p className="mt-5 max-w-xl text-lg text-muted-foreground">
            La forma más sencilla de emitir CFDI 4.0 desde tu celular. Sin formularios eternos,
            sin tecnicismos del SAT.
          </p>

          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              to="/auth"
              className="group inline-flex items-center gap-2 rounded-full bg-foreground px-6 py-3.5 text-sm font-semibold text-background hover:opacity-90 transition"
            >
              Empezar gratis
              <ArrowRight className="size-4 transition group-hover:translate-x-0.5" />
            </Link>
            <Link
              to="/auth"
              className="inline-flex items-center gap-2 rounded-full border border-border bg-surface px-6 py-3.5 text-sm font-semibold hover:bg-accent transition"
            >
              Ya tengo cuenta
            </Link>
          </div>
        </div>

        <div className="mt-20 grid gap-4 sm:grid-cols-3">
          {[
            { icon: Zap, title: "Rápido de verdad", body: "Crea, timbra y envía una factura sin salir de tu celular." },
            { icon: ShieldCheck, title: "Sin errores fiscales", body: "Validamos RFC, régimen y uso CFDI antes de timbrar." },
            { icon: Sparkles, title: "Diseñado para ti", body: "Interfaz sencilla, pensada para freelancers y pequeñas empresas." },
          ].map((f) => (
            <div key={f.title} className="rounded-3xl border border-border bg-surface p-6 shadow-soft">
              <div className="grid size-10 place-items-center rounded-2xl bg-primary-soft text-primary">
                <f.icon className="size-5" />
              </div>
              <h3 className="mt-4 font-semibold">{f.title}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{f.body}</p>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
