import { useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, CheckCircle2, Eye, EyeOff, Loader2, ShieldCheck, Upload } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { isCsdConfigured, type CompanyProfileData } from "./company-profile";

async function getFunctionErrorMessage(error: unknown, fallback: string): Promise<string> {
  const context = (error as { context?: Response })?.context;
  if (context && typeof context.json === "function") {
    try {
      const body = await context.json();
      if (body?.error) return body.error as string;
    } catch {
      // El cuerpo no era JSON o ya fue consumido.
    }
  }
  return error instanceof Error ? error.message : fallback;
}

export function CsdForm({ profile }: { profile: CompanyProfileData }) {
  const queryClient = useQueryClient();
  const cerInputRef = useRef<HTMLInputElement>(null);
  const keyInputRef = useRef<HTMLInputElement>(null);
  const [cerFile, setCerFile] = useState<File | null>(null);
  const [keyFile, setKeyFile] = useState<File | null>(null);
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const configured = isCsdConfigured(profile.company);
  const hasExistingFiles = Boolean(profile.company?.csd_cer_url && profile.company?.csd_key_url);
  const hasReplacementFiles = Boolean(cerFile && keyFile);
  const canSave = (hasReplacementFiles || (!cerFile && !keyFile && hasExistingFiles)) && password.length > 0;

  async function save() {
    if (!profile.company) {
      toast.error("Primero guarda los datos fiscales del perfil");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      let cerPath: string | undefined;
      let keyPath: string | undefined;
      if (hasReplacementFiles) {
        const stagingId = crypto.randomUUID();
        cerPath = `${profile.user.id}/csd-staging/${stagingId}/cert.cer`;
        keyPath = `${profile.user.id}/csd-staging/${stagingId}/key.key`;
        const [cerUpload, keyUpload] = await Promise.all([
          supabase.storage.from("csd-files").upload(cerPath, cerFile!, { upsert: false }),
          supabase.storage.from("csd-files").upload(keyPath, keyFile!, { upsert: false }),
        ]);
        if (cerUpload.error) throw cerUpload.error;
        if (keyUpload.error) throw keyUpload.error;
      }

      const { data, error: functionError } = await supabase.functions.invoke("validate-csd", {
        body: { company_id: profile.company.id, password, cer_path: cerPath, key_path: keyPath },
      });
      if (functionError) throw new Error(await getFunctionErrorMessage(functionError, "No pudimos validar tu CSD."));
      if (!data?.success) throw new Error(data?.error ?? "No pudimos validar tu CSD.");

      toast.success("CSD validado y guardado correctamente");
      setCerFile(null);
      setKeyFile(null);
      setPassword("");
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["company-profile"] }),
        queryClient.invalidateQueries({ queryKey: ["profile"] }),
        queryClient.invalidateQueries({ queryKey: ["dashboard"] }),
      ]);
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "No pudimos guardar el CSD";
      setError(message);
      toast.error(message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="space-y-3">
      {configured ? <Status configured /> : <Status configured={false} />}
      {/* Android maps `accept` extensions to MIME types via the OS registry; .cer/.key
          aren't registered on most phones, so without a binary fallback the file picker
          greys out every file as "not allowed". */}
      <input ref={cerInputRef} type="file" accept=".cer,application/x-x509-ca-cert,application/pkix-cert,application/octet-stream" className="hidden" onChange={(e) => setCerFile(e.target.files?.[0] ?? null)} />
      <input ref={keyInputRef} type="file" accept=".key,application/octet-stream" className="hidden" onChange={(e) => setKeyFile(e.target.files?.[0] ?? null)} />
      <FileField label="Certificado (.cer)" file={cerFile} existing={Boolean(profile.company?.csd_cer_url)} onClick={() => cerInputRef.current?.click()} />
      <FileField label="Llave privada (.key)" file={keyFile} existing={Boolean(profile.company?.csd_key_url)} onClick={() => keyInputRef.current?.click()} />
      <Field label="Contraseña del CSD">
        <div className="relative">
          <input type={showPassword ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Contraseña de tu llave privada" className="ff-input pr-10" />
          <button type="button" onClick={() => setShowPassword((visible) => !visible)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" aria-label={showPassword ? "Ocultar" : "Mostrar"}>
            {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
          </button>
        </div>
        <p className="mt-1.5 text-[11px] text-muted-foreground">Nunca se guarda: solo se usa para validar y se descarta de inmediato.</p>
      </Field>
      {error && <p className="rounded-xl bg-destructive/10 px-3 py-2.5 text-[12px] text-destructive">{error}</p>}
      <button type="button" onClick={save} disabled={!canSave || saving} className="flex w-full items-center justify-center gap-2 rounded-2xl bg-foreground py-4 text-sm font-semibold text-background transition active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40">
        {saving ? <Loader2 className="size-4 animate-spin" /> : "Guardar CSD"}
      </button>
      <p className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-[11px] text-amber-800"><ShieldCheck className="mt-0.5 size-3.5 shrink-0" />Tus archivos CSD se almacenan cifrados y solo son accesibles por ti.</p>
    </section>
  );
}

function Status({ configured }: { configured: boolean }) {
  return configured ? <div className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-[11px] font-semibold text-emerald-700"><CheckCircle2 className="size-3.5" />CSD configurado</div> : <div className="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-[11px] font-semibold text-amber-800"><AlertTriangle className="size-3.5" />Sin CSD — no podrás timbrar</div>;
}

function FileField({ label, file, existing, onClick }: { label: string; file: File | null; existing: boolean; onClick: () => void }) {
  return <Field label={label}><button type="button" onClick={onClick} className="ff-input flex items-center gap-2 text-left"><span className="flex min-w-0 flex-1 items-center gap-2 text-sm"><Upload className="size-4 shrink-0 text-muted-foreground" /><span className="min-w-0 flex-1 truncate">{file?.name ?? `Seleccionar archivo ${label.match(/\(.+\)/)?.[0] ?? ""}`}</span></span><span className="shrink-0 text-xs font-semibold text-primary">{file ? "Cambiar" : "Subir"}</span></button>{!file && existing && <p className="mt-1.5 flex items-center gap-1 text-[11px] text-emerald-700"><CheckCircle2 className="size-3" />Archivo cargado</p>}</Field>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block"><span className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">{label}</span>{children}</label>;
}
