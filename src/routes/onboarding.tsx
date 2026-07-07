import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { ArrowRight, Loader2, Upload, CheckCircle2, Lock, Image as ImageIcon } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { TAX_REGIMES } from "@/lib/sat-catalogs";
import { normalizeFiscalName, validateRfcStrict } from "@/lib/fiscal";

export const Route = createFileRoute("/onboarding")({
  ssr: false,
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/auth" });
    return { user: data.user };
  },
  head: () => ({
    meta: [{ title: "Configuración inicial — Factura Fácil" }],
  }),
  component: OnboardingPage,
});

type StepAErrors = Partial<Record<"rfc" | "legal_name" | "tax_regime" | "postal_code", string>>;

function OnboardingPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState<1 | 2>(1);
  const [loading, setLoading] = useState(false);
  const [bootstrapping, setBootstrapping] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [companyId, setCompanyId] = useState<string | null>(null);

  // Section A — required
  const [rfc, setRfc] = useState("");
  const [legalName, setLegalName] = useState("");
  const [taxRegime, setTaxRegime] = useState("");
  const [postalCode, setPostalCode] = useState("");

  // Section B — optional
  const [tradeName, setTradeName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [existingLogoUrl, setExistingLogoUrl] = useState<string | null>(null);

  const [errors, setErrors] = useState<StepAErrors>({});
  const [attempted, setAttempted] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return;
      setUserId(u.user.id);
      setEmail((prev) => prev || u.user!.email || "");
      const { data: comp } = await supabase
        .from("companies")
        .select("id, rfc, legal_name, tax_regime, postal_code, trade_name, phone, email, logo_url, onboarding_completed")
        .eq("user_id", u.user.id)
        .maybeSingle();
      if (comp) {
        setCompanyId(comp.id);
        setRfc(comp.rfc ?? "");
        setLegalName(comp.legal_name ?? "");
        setTaxRegime(comp.tax_regime ?? "");
        setPostalCode(comp.postal_code ?? "");
        setTradeName(comp.trade_name ?? "");
        setPhone(comp.phone ?? "");
        setEmail(comp.email ?? u.user.email ?? "");
        setExistingLogoUrl(comp.logo_url ?? null);
        if (comp.onboarding_completed) {
          navigate({ to: "/dashboard", replace: true });
          return;
        }
        // If section A already saved, jump to step 2
        if (comp.rfc && comp.legal_name && comp.tax_regime && comp.postal_code) {
          setStep(2);
        }
      }
      setBootstrapping(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const stepAValid = useMemo(() => Object.keys(validateStepA({ rfc, legalName, taxRegime, postalCode })).length === 0, [rfc, legalName, taxRegime, postalCode]);

  function onLogoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    if (!f.type.startsWith("image/")) {
      toast.error("El logo debe ser una imagen (PNG, JPG, SVG).");
      return;
    }
    if (f.size > 2 * 1024 * 1024) {
      toast.error("El logo no debe superar 2 MB.");
      return;
    }
    setLogoFile(f);
    setLogoPreview(URL.createObjectURL(f));
  }

  async function onContinue() {
    setAttempted(true);
    const e = validateStepA({ rfc, legalName, taxRegime, postalCode });
    setErrors(e);
    if (Object.keys(e).length > 0) {
      toast.error("Completa los datos fiscales obligatorios para continuar.");
      return;
    }
    if (!userId) return;
    setLoading(true);
    try {
      // Upload logo (optional)
      let logoUrl: string | null = existingLogoUrl;
      if (logoFile) {
        const ext = logoFile.name.split(".").pop()?.toLowerCase() || "png";
        const path = `${userId}/logo-${Date.now()}.${ext}`;
        const { error: upErr } = await supabase.storage
          .from("company-logos")
          .upload(path, logoFile, { upsert: true, contentType: logoFile.type });
        if (upErr) throw upErr;
        logoUrl = path; // store storage path; signed URL generated on demand
      }

      const payload = {
        user_id: userId,
        rfc: rfc.trim().toUpperCase(),
        legal_name: normalizeFiscalName(legalName),
        tax_regime: taxRegime,
        postal_code: postalCode.trim(),
        trade_name: tradeName.trim() || null,
        phone: phone.trim() || null,
        email: email.trim() || null,
        logo_url: logoUrl,
        is_default: true,
      };

      const res = companyId
        ? await supabase.from("companies").update(payload).eq("id", companyId).select("id").single()
        : await supabase.from("companies").insert(payload).select("id").single();
      if (res.error) throw res.error;
      setCompanyId(res.data.id);
      toast.success("Datos fiscales guardados. Continúa con el CSD.");
      setStep(2);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No pudimos guardar tus datos.");
    } finally {
      setLoading(false);
    }
  }

  if (bootstrapping) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-[#011025] text-[#C2E8FF]">
        <Loader2 className="size-6 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-gradient-to-br from-[#011025] via-[#012a4a] to-[#023e7d] px-4 py-10 text-foreground">
      <div className="mx-auto w-full max-w-2xl">
        <header className="mb-8 text-[#C2E8FF]">
          <div className="flex items-center gap-2">
            <div className="grid size-9 place-items-center rounded-xl bg-[#C2E8FF] font-bold text-[#011025]">F</div>
            <span className="font-semibold tracking-tight">Factura Fácil</span>
          </div>
          <h1 className="mt-6 text-3xl font-bold tracking-tight text-white">
            Configura tu perfil fiscal
          </h1>
          <p className="mt-2 text-sm text-[#C2E8FF]/80">
            Sólo unos minutos. Usaremos estos datos para timbrar tus CFDI 4.0 ante el SAT.
          </p>
          <ol className="mt-6 flex gap-2 text-xs font-medium">
            <StepDot n={1} label="Perfil fiscal" active={step === 1} done={step > 1} />
            <StepDot n={2} label="Certificado (CSD)" active={step === 2} done={false} />
          </ol>
        </header>

        {step === 1 ? (
          <div className="rounded-3xl bg-background p-6 shadow-2xl sm:p-8">
            {/* Section A */}
            <div>
              <h2 className="text-lg font-semibold tracking-tight">Datos fiscales</h2>
              <p className="mt-1 text-xs text-muted-foreground">
                Como aparecen en tu Constancia de Situación Fiscal. Obligatorios para poder timbrar.
              </p>
              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                <Field
                  label="RFC"
                  required
                  error={attempted ? errors.rfc : undefined}
                >
                  <input
                    value={rfc}
                    onChange={(e) => setRfc(e.target.value.toUpperCase())}
                    onBlur={() => setErrors((prev) => ({ ...prev, ...pickErrors(validateStepA({ rfc, legalName, taxRegime, postalCode }), ["rfc"]) }))}
                    placeholder="XAXX010101000"
                    maxLength={13}
                    className={inputCls(attempted && !!errors.rfc)}
                  />
                </Field>
                <Field
                  label="Código postal"
                  required
                  error={attempted ? errors.postal_code : undefined}
                >
                  <input
                    value={postalCode}
                    onChange={(e) => setPostalCode(e.target.value.replace(/\D/g, "").slice(0, 5))}
                    onBlur={() => setErrors((prev) => ({ ...prev, ...pickErrors(validateStepA({ rfc, legalName, taxRegime, postalCode }), ["postal_code"]) }))}
                    placeholder="06600"
                    inputMode="numeric"
                    className={inputCls(attempted && !!errors.postal_code)}
                  />
                </Field>
                <Field
                  label="Nombre o razón social"
                  required
                  error={attempted ? errors.legal_name : undefined}
                  className="sm:col-span-2"
                >
                  <input
                    value={legalName}
                    onChange={(e) => setLegalName(e.target.value)}
                    onBlur={() => {
                      setLegalName((v) => normalizeFiscalName(v));
                      setErrors((prev) => ({ ...prev, ...pickErrors(validateStepA({ rfc, legalName, taxRegime, postalCode }), ["legal_name"]) }));
                    }}
                    placeholder="JUAN PEREZ LOPEZ"
                    className={inputCls(attempted && !!errors.legal_name)}
                  />
                </Field>
                <Field
                  label="Régimen fiscal"
                  required
                  error={attempted ? errors.tax_regime : undefined}
                  className="sm:col-span-2"
                >
                  <select
                    value={taxRegime}
                    onChange={(e) => setTaxRegime(e.target.value)}
                    className={inputCls(attempted && !!errors.tax_regime)}
                  >
                    <option value="">Selecciona tu régimen…</option>
                    {TAX_REGIMES.map((r) => (
                      <option key={r.code} value={r.code}>
                        {r.code} — {r.name}
                      </option>
                    ))}
                  </select>
                </Field>
              </div>
            </div>

            {/* Section B */}
            <div className="mt-8 border-t border-border pt-6">
              <h2 className="text-lg font-semibold tracking-tight">Detalles del negocio</h2>
              <p className="mt-1 text-xs text-muted-foreground">
                Opcional. Puedes completarlos después desde tu perfil.
              </p>

              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                <Field label="Nombre comercial" className="sm:col-span-2">
                  <input
                    value={tradeName}
                    onChange={(e) => setTradeName(e.target.value)}
                    placeholder="Mi Negocio"
                    className={inputCls(false)}
                  />
                </Field>
                <Field label="Teléfono">
                  <input
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="55 1234 5678"
                    className={inputCls(false)}
                  />
                </Field>
                <Field label="Email de contacto">
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="hola@midominio.mx"
                    className={inputCls(false)}
                  />
                </Field>

                <Field label="Logo del negocio" className="sm:col-span-2">
                  <div className="flex items-center gap-3">
                    <div className="grid size-16 shrink-0 place-items-center overflow-hidden rounded-xl border border-input bg-muted">
                      {logoPreview ? (
                        <img src={logoPreview} alt="Vista previa del logo" className="size-full object-contain" />
                      ) : (
                        <ImageIcon className="size-6 text-muted-foreground" />
                      )}
                    </div>
                    <label className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-input bg-background px-4 py-2 text-xs font-medium hover:bg-accent">
                      <Upload className="size-4" />
                      {logoFile ? "Cambiar logo" : "Subir logo"}
                      <input type="file" accept="image/*" className="hidden" onChange={onLogoChange} />
                    </label>
                    {logoFile && (
                      <span className="inline-flex items-center gap-1 text-xs text-emerald-600">
                        <CheckCircle2 className="size-4" /> Listo para subir
                      </span>
                    )}
                  </div>
                  <p className="mt-2 text-[11px] text-muted-foreground">
                    PNG, JPG o SVG · máx 2 MB. Se usará más adelante en tus facturas.
                  </p>
                </Field>
              </div>
            </div>

            <div className="mt-8 flex flex-col-reverse items-stretch justify-between gap-3 sm:flex-row sm:items-center">
              <p className="text-xs text-muted-foreground">
                Al continuar aceptas que estos datos se usarán para emitir CFDI a tu nombre.
              </p>
              <button
                type="button"
                onClick={onContinue}
                disabled={loading || (attempted && !stepAValid)}
                className="inline-flex items-center justify-center gap-2 rounded-full bg-[#011025] px-6 py-3 text-sm font-semibold text-[#C2E8FF] shadow-lg transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {loading ? <Loader2 className="size-4 animate-spin" /> : <ArrowRight className="size-4" />}
                Continuar al paso 2
              </button>
            </div>
          </div>
        ) : (
          <StepTwoCsd companyId={companyId} userId={userId} />
        )}
      </div>
    </div>
  );
}

type CsdErrors = Partial<Record<"cer" | "key" | "password", string>>;

function StepTwoCsd({ companyId, userId }: { companyId: string | null; userId: string | null }) {
  const navigate = useNavigate();
  const [cerFile, setCerFile] = useState<File | null>(null);
  const [keyFile, setKeyFile] = useState<File | null>(null);
  const [password, setPassword] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [errors, setErrors] = useState<CsdErrors>({});
  const [validating, setValidating] = useState(false);
  const [saving, setSaving] = useState(false);

  function pickFile(kind: "cer" | "key") {
    return (e: React.ChangeEvent<HTMLInputElement>) => {
      const f = e.target.files?.[0] ?? null;
      setErrors((prev) => ({ ...prev, [kind]: undefined }));
      if (!f) {
        kind === "cer" ? setCerFile(null) : setKeyFile(null);
        return;
      }
      if (f.size > 512 * 1024) {
        setErrors((prev) => ({ ...prev, [kind]: `El archivo .${kind} es demasiado grande (máx 512 KB).` }));
        return;
      }
      const ext = f.name.split(".").pop()?.toLowerCase();
      if (kind === "cer" && ext !== "cer") {
        setErrors((prev) => ({ ...prev, cer: "Selecciona el archivo con extensión .cer del SAT." }));
        return;
      }
      if (kind === "key" && ext !== "key") {
        setErrors((prev) => ({ ...prev, key: "Selecciona el archivo con extensión .key del SAT." }));
        return;
      }
      kind === "cer" ? setCerFile(f) : setKeyFile(f);
    };
  }

  async function onValidateAndSave() {
    const nextErrors: CsdErrors = {};
    if (!cerFile) nextErrors.cer = "Sube tu archivo .cer.";
    if (!keyFile) nextErrors.key = "Sube tu archivo .key.";
    if (!password.trim()) nextErrors.password = "Escribe la contraseña de tu llave privada.";
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;
    if (!userId || !companyId) {
      toast.error("Sesión no válida. Vuelve a iniciar sesión.");
      return;
    }

    setSaving(true);
    try {
      // 1) Subir archivos al bucket privado csd-files en rutas deterministas
      const cerPath = `${userId}/${companyId}/cert.cer`;
      const keyPath = `${userId}/${companyId}/key.key`;

      const [cerUp, keyUp] = await Promise.all([
        supabase.storage.from("csd-files").upload(cerPath, cerFile!, {
          upsert: true,
          contentType: "application/pkix-cert",
        }),
        supabase.storage.from("csd-files").upload(keyPath, keyFile!, {
          upsert: true,
          contentType: "application/pkcs8",
        }),
      ]);
      if (cerUp.error) throw cerUp.error;
      if (keyUp.error) throw keyUp.error;

      // 2) Guardar rutas en companies
      const { error: pathErr } = await supabase
        .from("companies")
        .update({ csd_cer_url: cerPath, csd_key_url: keyPath })
        .eq("id", companyId);
      if (pathErr) throw pathErr;

      // 3) Validar en servidor vía Edge Function (nunca guardamos la contraseña)
      setSaving(false);
      setValidating(true);

      const { data, error } = await supabase.functions.invoke("validar-csd", {
        body: { company_id: companyId, password },
      });
      if (error) throw new Error(error.message || "No pudimos validar el CSD.");

      const res = data as {
        success: boolean;
        error?: string;
        field?: "cer" | "key" | "password";
      };

      if (!res?.success) {
        const field = res?.field ?? "password";
        const msg = res?.error ?? "El certificado no es válido.";
        setErrors({ [field]: msg });
        toast.error(msg);
        return;
      }

      // Éxito → limpiar aviso persistente del dashboard y avanzar
      try {
        window.localStorage.removeItem("ff.csdBannerDismissed");
      } catch {
        // ignore
      }

      toast.success("Certificado validado y guardado correctamente.");
      navigate({ to: "/dashboard", replace: true });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Error validando el CSD.";
      toast.error(msg);
    } finally {
      setValidating(false);
      setSaving(false);
    }
  }


  const busy = validating || saving;

  return (
    <div className="rounded-3xl bg-background p-6 shadow-2xl sm:p-8">
      <div className="flex items-start gap-3">
        <div className="grid size-11 shrink-0 place-items-center rounded-2xl bg-[#C2E8FF] text-[#011025]">
          <Lock className="size-5" />
        </div>
        <div className="min-w-0">
          <h2 className="text-lg font-semibold tracking-tight">Paso 2 · Certificado de Sello Digital (CSD)</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Sube tu archivo <strong>.cer</strong> y tu llave privada <strong>.key</strong> junto con su contraseña. Los validamos antes de guardarlos y nunca almacenamos la contraseña.
          </p>
        </div>
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <CsdFileField
          label="Archivo .cer"
          accept=".cer,application/pkix-cert"
          file={cerFile}
          onChange={pickFile("cer")}
          error={errors.cer}
        />
        <CsdFileField
          label="Archivo .key"
          accept=".key"
          file={keyFile}
          onChange={pickFile("key")}
          error={errors.key}
        />
        <label className="block sm:col-span-2">
          <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Contraseña de la llave privada <span className="text-destructive">*</span>
          </span>
          <div className="relative">
            <input
              type={showPwd ? "text" : "password"}
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                if (errors.password) setErrors((prev) => ({ ...prev, password: undefined }));
              }}
              placeholder="La que capturaste al generar el CSD"
              autoComplete="off"
              className={inputCls(!!errors.password) + " pr-20"}
            />
            <button
              type="button"
              onClick={() => setShowPwd((v) => !v)}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md px-2 py-1 text-[11px] font-semibold text-muted-foreground hover:bg-accent"
            >
              {showPwd ? "Ocultar" : "Mostrar"}
            </button>
          </div>
          {errors.password && (
            <span className="mt-1 block text-[11px] font-medium text-destructive">{errors.password}</span>
          )}
          <span className="mt-1 block text-[11px] text-muted-foreground">
            Nunca guardamos tu contraseña. Se usa solo en el servidor para validar la llave y se descarta al terminar.
          </span>
        </label>
      </div>

      <div className="mt-8 flex flex-col-reverse items-stretch justify-between gap-3 sm:flex-row sm:items-center">
        <div className="flex flex-col gap-2 sm:flex-row">
          <button
            type="button"
            disabled={busy}
            onClick={() => navigate({ to: "/dashboard", replace: true })}
            className="inline-flex items-center justify-center gap-2 rounded-full border border-input bg-background px-5 py-2.5 text-xs font-semibold text-foreground transition hover:bg-accent disabled:opacity-50"
          >
            <ArrowRight className="size-4" /> Omitir por ahora
          </button>
        </div>
        <button
          type="button"
          onClick={onValidateAndSave}
          disabled={busy}
          className="inline-flex items-center justify-center gap-2 rounded-full bg-[#011025] px-6 py-3 text-sm font-semibold text-[#C2E8FF] shadow-lg transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {busy ? <Loader2 className="size-4 animate-spin" /> : <CheckCircle2 className="size-4" />}
          {validating ? "Validando certificado…" : saving ? "Guardando…" : "Validar y guardar CSD"}
        </button>
      </div>
    </div>
  );
}

function CsdFileField({
  label,
  accept,
  file,
  onChange,
  error,
}: {
  label: string;
  accept: string;
  file: File | null;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  error?: string;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label} <span className="text-destructive">*</span>
      </span>
      <div
        className={`flex items-center gap-3 rounded-xl border bg-background px-3 py-2.5 text-sm transition ${
          error ? "border-destructive" : "border-input"
        }`}
      >
        <label className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-input bg-background px-3 py-1.5 text-xs font-semibold hover:bg-accent">
          <Upload className="size-4" />
          {file ? "Cambiar" : "Elegir archivo"}
          <input type="file" accept={accept} className="hidden" onChange={onChange} />
        </label>
        <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">
          {file ? file.name : "Ningún archivo seleccionado"}
        </span>
        {file && !error && <CheckCircle2 className="size-4 shrink-0 text-emerald-600" />}
      </div>
      {error && <span className="mt-1 block text-[11px] font-medium text-destructive">{error}</span>}
    </label>
  );
}

function StepDot({ n, label, active, done }: { n: number; label: string; active: boolean; done: boolean }) {
  return (
    <li
      className={`flex items-center gap-2 rounded-full border px-3 py-1.5 ${
        active
          ? "border-[#C2E8FF] bg-[#C2E8FF] text-[#011025]"
          : done
            ? "border-emerald-400/40 bg-emerald-400/10 text-emerald-100"
            : "border-white/20 bg-white/5 text-white/60"
      }`}
    >
      <span className="grid size-5 place-items-center rounded-full bg-black/10 text-[10px] font-bold">
        {done ? <CheckCircle2 className="size-3.5" /> : n}
      </span>
      {label}
    </li>
  );
}

function Field({
  label,
  required,
  error,
  className,
  children,
}: {
  label: string;
  required?: boolean;
  error?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <label className={`block ${className ?? ""}`}>
      <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label} {required && <span className="text-destructive">*</span>}
      </span>
      {children}
      {error && <span className="mt-1 block text-[11px] font-medium text-destructive">{error}</span>}
    </label>
  );
}

function inputCls(hasError: boolean) {
  return `w-full rounded-xl border bg-background px-3 py-2.5 text-sm outline-none transition focus:ring-2 focus:ring-[#023e7d]/30 ${
    hasError ? "border-destructive text-destructive focus:border-destructive" : "border-input focus:border-[#023e7d]"
  }`;
}

function validateStepA(v: { rfc: string; legalName: string; taxRegime: string; postalCode: string }): StepAErrors {
  const e: StepAErrors = {};
  const rfcCheck = validateRfcStrict(v.rfc);
  if (!v.rfc.trim()) e.rfc = "El RFC es obligatorio.";
  else if (!rfcCheck.valid) e.rfc = rfcCheck.reason;
  if (!v.legalName.trim()) e.legal_name = "Escribe tu nombre o razón social tal como aparece en la constancia.";
  if (!v.taxRegime) e.tax_regime = "Selecciona tu régimen fiscal.";
  if (!v.postalCode.trim()) e.postal_code = "El código postal es obligatorio.";
  else if (!/^\d{5}$/.test(v.postalCode.trim())) e.postal_code = "El código postal debe tener 5 dígitos.";
  return e;
}

function pickErrors<T extends Record<string, string | undefined>>(all: T, keys: (keyof T)[]): Partial<T> {
  const out: Partial<T> = {};
  for (const k of keys) if (all[k]) out[k] = all[k];
  return out;
}
