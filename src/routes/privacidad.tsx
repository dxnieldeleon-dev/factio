import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/privacidad")({
  head: () => ({
    meta: [
      { title: "Aviso de Privacidad — Factio" },
      { name: "description", content: "Aviso de privacidad de Factio conforme a la LFPDPPP." },
    ],
  }),
  component: Privacidad,
});

function Privacidad() {
  return (
    <div className="min-h-dvh bg-background text-foreground">
      <header className="mx-auto flex max-w-3xl items-center justify-between px-5 pt-8">
        <Link to="/" className="font-semibold tracking-tight">
          Factio
        </Link>
      </header>

      <main className="mx-auto max-w-3xl px-5 pb-24 pt-10">
        <h1 className="text-3xl font-bold tracking-tight">Aviso de Privacidad</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Última actualización: 30 de julio de 2026
        </p>

        <div className="prose prose-sm mt-8 max-w-none space-y-6 text-sm leading-relaxed text-foreground [&_h2]:mt-8 [&_h2]:text-base [&_h2]:font-semibold [&_p]:text-muted-foreground [&_li]:text-muted-foreground [&_ul]:list-disc [&_ul]:pl-5">
          <section>
            <p>
              En cumplimiento de la Ley Federal de Protección de Datos Personales en Posesión de los
              Particulares (LFPDPPP), ponemos a tu disposición el presente Aviso de Privacidad
              respecto del tratamiento de tus datos personales al usar Factio ("el Servicio").
            </p>
          </section>

          <section>
            <h2>1. Responsable del tratamiento</h2>
            <p>
              <span className="font-medium text-foreground">Factio</span>, con domicilio en{" "}
              <span className="font-medium text-foreground">Pedro María Anaya 2532C</span>, es
              responsable del tratamiento de tus datos personales.
            </p>
          </section>

          <section>
            <h2>2. Datos personales que recabamos</h2>
            <ul>
              <li>Datos de identificación y contacto: nombre, correo electrónico, teléfono.</li>
              <li>
                Datos fiscales: RFC, razón o denominación social, régimen fiscal, domicilio fiscal,
                y los datos de tus clientes que registres para facturarles.
              </li>
              <li>
                Certificado de Sello Digital (CSD): tu certificado y llave privada se usan
                únicamente para validar y registrar tu capacidad de timbrado ante el PAC; la
                contraseña del CSD no se almacena, solo se usa en memoria al momento de la
                validación.
              </li>
              <li>
                Datos de facturación y pago: se procesan directamente por Stripe; Factio no almacena
                números de tarjeta.
              </li>
              <li>
                Datos de uso técnico: dirección IP, tipo de dispositivo, registros de actividad
                dentro de la app.
              </li>
            </ul>
          </section>

          <section>
            <h2>3. Finalidades del tratamiento</h2>
            <p>
              <span className="font-medium text-foreground">Finalidades primarias</span> (necesarias
              para el Servicio):
            </p>
            <ul>
              <li>Crear y administrar tu cuenta.</li>
              <li>Generar, timbrar y cancelar tus CFDI ante el PAC y el SAT.</li>
              <li>Procesar el cobro de tu suscripción y administrar tu saldo de timbres.</li>
              <li>Brindarte soporte y comunicarte avisos relevantes del Servicio.</li>
            </ul>
            <p>
              <span className="font-medium text-foreground">Finalidades secundarias</span> (puedes
              oponerte sin que esto afecte el Servicio):
            </p>
            <ul>
              <li>Enviarte comunicaciones sobre nuevas funciones o promociones.</li>
              <li>Análisis interno para mejorar el producto.</li>
            </ul>
          </section>

          <section>
            <h2>4. Transferencias de datos</h2>
            <p>Para operar el Servicio compartimos los datos estrictamente necesarios con:</p>
            <ul>
              <li>
                <span className="font-medium text-foreground">Facturama</span> (PAC autorizado por
                el SAT), para timbrar y cancelar tus CFDI.
              </li>
              <li>
                <span className="font-medium text-foreground">Stripe</span>, para procesar pagos de
                tu suscripción.
              </li>
              <li>
                <span className="font-medium text-foreground">Supabase</span>, como proveedor de
                infraestructura (base de datos y almacenamiento) que aloja tu información.
              </li>
            </ul>
            <p>No vendemos tus datos personales a terceros.</p>
          </section>

          <section>
            <h2>5. Derechos ARCO</h2>
            <p>
              Tienes derecho a Acceder, Rectificar y Cancelar tus datos personales, así como a
              Oponerte a su tratamiento (derechos ARCO), y a revocar tu consentimiento en cualquier
              momento. Para ejercerlos, escríbenos a{" "}
              <a
                href="mailto:daniel.eusebio@factio.mx"
                className="font-medium text-primary hover:underline"
              >
                daniel.eusebio@factio.mx
              </a>
              . Responderemos dentro de los plazos que marca la ley.
            </p>
          </section>

          <section>
            <h2>6. Seguridad de tus datos</h2>
            <p>
              Aplicamos controles de acceso por usuario a nivel de base de datos (Row Level
              Security), almacenamiento privado y particionado para tu CSD y tus comprobantes
              fiscales, y no persistimos la contraseña de tu CSD.
            </p>
          </section>

          <section>
            <h2>7. Cookies y tecnologías similares</h2>
            <p>
              Usamos cookies estrictamente necesarias para mantener tu sesión iniciada. No usamos
              cookies de rastreo publicitario de terceros.
            </p>
          </section>

          <section>
            <h2>8. Cambios a este aviso</h2>
            <p>
              Podemos actualizar este Aviso de Privacidad. Los cambios sustanciales se notificarán
              dentro del Servicio o por correo electrónico.
            </p>
          </section>

          <section>
            <h2>9. Contacto</h2>
            <p>
              Dudas sobre este Aviso:{" "}
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
