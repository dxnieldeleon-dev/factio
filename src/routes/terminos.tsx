import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/terminos")({
  head: () => ({
    meta: [
      { title: "Términos y Condiciones — Factio" },
      { name: "description", content: "Términos y condiciones de uso de Factio." },
    ],
  }),
  component: Terminos,
});

function Terminos() {
  return (
    <div className="min-h-dvh bg-background text-foreground">
      <header className="mx-auto flex max-w-3xl items-center justify-between px-5 pt-8">
        <Link to="/" className="font-semibold tracking-tight">
          Factio
        </Link>
      </header>

      <main className="mx-auto max-w-3xl px-5 pb-24 pt-10">
        <h1 className="text-3xl font-bold tracking-tight">Términos y Condiciones</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Última actualización: 30 de julio de 2026
        </p>

        <div className="prose prose-sm mt-8 max-w-none space-y-6 text-sm leading-relaxed text-foreground [&_h2]:mt-8 [&_h2]:text-base [&_h2]:font-semibold [&_p]:text-muted-foreground [&_li]:text-muted-foreground">
          <section>
            <h2>1. Aceptación de los términos</h2>
            <p>
              Al crear una cuenta o usar Factio ("el Servicio") aceptas estos Términos y Condiciones
              y el{" "}
              <Link to="/privacidad" className="font-medium text-primary hover:underline">
                Aviso de Privacidad
              </Link>
              . Si no estás de acuerdo, no debes usar el Servicio.
            </p>
          </section>

          <section>
            <h2>2. Descripción del servicio</h2>
            <p>
              Factio es una plataforma para emitir, administrar y cancelar Comprobantes Fiscales
              Digitales por Internet (CFDI 4.0) conforme a la normativa del SAT (México). Factio
              actúa como intermediario tecnológico ante un Proveedor Autorizado de Certificación
              (PAC); no somos el SAT ni sustituimos la asesoría de un contador o abogado fiscal.
            </p>
          </section>

          <section>
            <h2>3. Registro y cuenta</h2>
            <p>
              Eres responsable de mantener la confidencialidad de tus credenciales de acceso y de
              toda actividad realizada desde tu cuenta. Debes proporcionar información veraz y
              mantenerla actualizada, en particular tus datos fiscales (RFC, régimen fiscal,
              domicilio fiscal) y tu Certificado de Sello Digital (CSD).
            </p>
          </section>

          <section>
            <h2>4. Responsabilidad sobre la información fiscal</h2>
            <p>
              Tú eres el único responsable de la exactitud de los datos fiscales, conceptos, montos,
              claves de producto/servicio y demás información que incluyas en tus facturas. Factio
              valida ciertos campos contra los catálogos públicos del SAT, pero esto no constituye
              asesoría fiscal ni garantiza que una factura sea correcta para tu situación
              particular. Te recomendamos validar tus obligaciones fiscales con un contador.
            </p>
          </section>

          <section>
            <h2>5. Planes, precios y timbres</h2>
            <p>
              El acceso a timbrar facturas requiere una suscripción de pago activa. Cada plan
              incluye un número determinado de timbres (facturas) por periodo, gestionados a través
              de un monedero digital. Los cobros se procesan mediante Stripe. Los precios pueden
              cambiar; te avisaremos con anticipación razonable de cualquier cambio que te afecte.
            </p>
          </section>

          <section>
            <h2>6. Cancelación y reembolsos</h2>
            <p>
              Puedes cancelar tu suscripción en cualquier momento; la cancelación surte efecto al
              final del periodo ya pagado. Los timbres no utilizados no son reembolsables salvo que
              la ley aplicable indique lo contrario. Las facturas ya timbradas ante el SAT solo
              pueden cancelarse conforme al procedimiento y los plazos que establece la autoridad
              fiscal.
            </p>
          </section>

          <section>
            <h2>7. Uso aceptable</h2>
            <p>
              No debes usar Factio para emitir comprobantes fiscales falsos, simulados o que amparen
              operaciones inexistentes, ni para ningún otro propósito ilegal. Nos reservamos el
              derecho de suspender cuentas que incumplan esta sección o que representen un riesgo de
              seguridad para otros usuarios.
            </p>
          </section>

          <section>
            <h2>8. Propiedad intelectual</h2>
            <p>
              El software, diseño, marca y contenidos de Factio son propiedad de sus titulares y
              están protegidos por la legislación aplicable. Tú conservas la propiedad de tus datos
              (clientes, productos, facturas).
            </p>
          </section>

          <section>
            <h2>9. Limitación de responsabilidad</h2>
            <p>
              Factio se ofrece "tal cual". En la medida permitida por la ley, no somos responsables
              por daños indirectos derivados del uso del Servicio, ni por interrupciones atribuibles
              a terceros (el PAC, el SAT, procesadores de pago o proveedores de infraestructura).
            </p>
          </section>

          <section>
            <h2>10. Terminación</h2>
            <p>
              Puedes cerrar tu cuenta cuando quieras. Podemos suspender o cerrar cuentas que
              incumplan estos términos, previo aviso salvo que exista un riesgo inmediato de
              seguridad o fraude.
            </p>
          </section>

          <section>
            <h2>11. Modificaciones</h2>
            <p>
              Podemos actualizar estos Términos ocasionalmente. Los cambios relevantes se
              notificarán dentro del Servicio o por correo electrónico antes de su entrada en vigor.
            </p>
          </section>

          <section>
            <h2>12. Ley aplicable</h2>
            <p>Estos Términos se rigen por las leyes de los Estados Unidos Mexicanos.</p>
          </section>

          <section>
            <h2>13. Contacto</h2>
            <p>
              Dudas sobre estos Términos:{" "}
              <a
                href="mailto:daniel.eusebio@factio.mx"
                className="font-medium text-primary hover:underline"
              >
                daniel.eusebio@factio.mx
              </a>
              .
            </p>
          </section>
        </div>
      </main>
    </div>
  );
}
