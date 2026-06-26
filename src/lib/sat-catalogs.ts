// Subconjunto de catálogos del SAT más usados. La integración real con PAC
// debería traer los catálogos completos desde el servicio del proveedor.

export const TAX_REGIMES = [
  { code: "601", name: "General de Ley Personas Morales" },
  { code: "603", name: "Personas Morales con Fines no Lucrativos" },
  { code: "605", name: "Sueldos y Salarios e Ingresos Asimilados a Salarios" },
  { code: "606", name: "Arrendamiento" },
  { code: "608", name: "Demás ingresos" },
  { code: "612", name: "Personas Físicas con Actividades Empresariales y Profesionales" },
  { code: "614", name: "Ingresos por intereses" },
  { code: "616", name: "Sin obligaciones fiscales" },
  { code: "621", name: "Incorporación Fiscal" },
  { code: "625", name: "Actividades Empresariales con ingresos a través de Plataformas Tecnológicas" },
  { code: "626", name: "Régimen Simplificado de Confianza (RESICO)" },
];

export const CFDI_USES = [
  { code: "G01", name: "Adquisición de mercancías" },
  { code: "G02", name: "Devoluciones, descuentos o bonificaciones" },
  { code: "G03", name: "Gastos en general" },
  { code: "I01", name: "Construcciones" },
  { code: "I04", name: "Equipo de cómputo y accesorios" },
  { code: "I08", name: "Otra maquinaria y equipo" },
  { code: "D01", name: "Honorarios médicos, dentales y gastos hospitalarios" },
  { code: "D10", name: "Pagos por servicios educativos (colegiaturas)" },
  { code: "P01", name: "Por definir" },
  { code: "S01", name: "Sin efectos fiscales" },
  { code: "CP01", name: "Pagos" },
];

export const PAYMENT_FORMS = [
  { code: "01", name: "Efectivo" },
  { code: "02", name: "Cheque nominativo" },
  { code: "03", name: "Transferencia electrónica de fondos" },
  { code: "04", name: "Tarjeta de crédito" },
  { code: "28", name: "Tarjeta de débito" },
  { code: "99", name: "Por definir" },
];

export const PAYMENT_METHODS = [
  { code: "PUE", name: "Pago en una sola exhibición" },
  { code: "PPD", name: "Pago en parcialidades o diferido" },
];

export const COMMON_SAT_KEYS = [
  { code: "01010101", name: "No existe en el catálogo" },
  { code: "84111506", name: "Servicios de facturación" },
  { code: "80101500", name: "Servicios de consultoría de negocios y administración corporativa" },
  { code: "81111500", name: "Servicios de sistemas y administración de componentes de sistemas" },
  { code: "81112000", name: "Servicios de programación informática" },
  { code: "82101500", name: "Servicios de publicidad" },
  { code: "78111800", name: "Transporte de carga" },
];

export const COMMON_SAT_UNITS = [
  { code: "E48", name: "Unidad de servicio" },
  { code: "H87", name: "Pieza" },
  { code: "ACT", name: "Actividad" },
  { code: "KGM", name: "Kilogramo" },
  { code: "LTR", name: "Litro" },
  { code: "MTR", name: "Metro" },
  { code: "HUR", name: "Hora" },
  { code: "DAY", name: "Día" },
];
