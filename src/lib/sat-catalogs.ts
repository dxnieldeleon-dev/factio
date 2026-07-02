// Subconjunto vigente de catálogos del SAT (CFDI 4.0).
// La integración con PAC debe sincronizar catálogos oficiales periódicamente.

export type SatItem = { code: string; name: string };

export const TAX_REGIMES: SatItem[] = [
  { code: "601", name: "General de Ley Personas Morales" },
  { code: "603", name: "Personas Morales con Fines no Lucrativos" },
  { code: "605", name: "Sueldos y Salarios e Ingresos Asimilados a Salarios" },
  { code: "606", name: "Arrendamiento" },
  { code: "607", name: "Régimen de Enajenación o Adquisición de Bienes" },
  { code: "608", name: "Demás ingresos" },
  { code: "610", name: "Residentes en el Extranjero sin Establecimiento Permanente en México" },
  { code: "611", name: "Ingresos por Dividendos (socios y accionistas)" },
  { code: "612", name: "Personas Físicas con Actividades Empresariales y Profesionales" },
  { code: "614", name: "Ingresos por intereses" },
  { code: "615", name: "Régimen de los ingresos por obtención de premios" },
  { code: "616", name: "Sin obligaciones fiscales" },
  { code: "620", name: "Sociedades Cooperativas de Producción que optan por diferir sus ingresos" },
  { code: "621", name: "Incorporación Fiscal" },
  { code: "622", name: "Actividades Agrícolas, Ganaderas, Silvícolas y Pesqueras" },
  { code: "623", name: "Opcional para Grupos de Sociedades" },
  { code: "624", name: "Coordinados" },
  { code: "625", name: "Actividades Empresariales con ingresos a través de Plataformas Tecnológicas" },
  { code: "626", name: "Régimen Simplificado de Confianza (RESICO)" },
];

export const CFDI_USES: SatItem[] = [
  { code: "G01", name: "Adquisición de mercancías" },
  { code: "G02", name: "Devoluciones, descuentos o bonificaciones" },
  { code: "G03", name: "Gastos en general" },
  { code: "I01", name: "Construcciones" },
  { code: "I02", name: "Mobiliario y equipo de oficina por inversiones" },
  { code: "I03", name: "Equipo de transporte" },
  { code: "I04", name: "Equipo de cómputo y accesorios" },
  { code: "I05", name: "Dados, troqueles, moldes, matrices y herramental" },
  { code: "I06", name: "Comunicaciones telefónicas" },
  { code: "I07", name: "Comunicaciones satelitales" },
  { code: "I08", name: "Otra maquinaria y equipo" },
  { code: "D01", name: "Honorarios médicos, dentales y gastos hospitalarios" },
  { code: "D02", name: "Gastos médicos por incapacidad o discapacidad" },
  { code: "D03", name: "Gastos funerales" },
  { code: "D04", name: "Donativos" },
  { code: "D05", name: "Intereses reales efectivamente pagados por créditos hipotecarios" },
  { code: "D06", name: "Aportaciones voluntarias al SAR" },
  { code: "D07", name: "Primas por seguros de gastos médicos" },
  { code: "D08", name: "Gastos de transportación escolar obligatoria" },
  { code: "D09", name: "Depósitos en cuentas para el ahorro / primas de pensiones" },
  { code: "D10", name: "Pagos por servicios educativos (colegiaturas)" },
  { code: "S01", name: "Sin efectos fiscales" },
  { code: "CP01", name: "Pagos" },
  { code: "CN01", name: "Nómina" },
];

export const PAYMENT_FORMS: SatItem[] = [
  { code: "01", name: "Efectivo" },
  { code: "02", name: "Cheque nominativo" },
  { code: "03", name: "Transferencia electrónica de fondos" },
  { code: "04", name: "Tarjeta de crédito" },
  { code: "05", name: "Monedero electrónico" },
  { code: "06", name: "Dinero electrónico" },
  { code: "08", name: "Vales de despensa" },
  { code: "12", name: "Dación en pago" },
  { code: "13", name: "Pago por subrogación" },
  { code: "14", name: "Pago por consignación" },
  { code: "15", name: "Condonación" },
  { code: "17", name: "Compensación" },
  { code: "23", name: "Novación" },
  { code: "24", name: "Confusión" },
  { code: "25", name: "Remisión de deuda" },
  { code: "26", name: "Prescripción o caducidad" },
  { code: "27", name: "A satisfacción del acreedor" },
  { code: "28", name: "Tarjeta de débito" },
  { code: "29", name: "Tarjeta de servicios" },
  { code: "30", name: "Aplicación de anticipos" },
  { code: "31", name: "Intermediario pagos" },
  { code: "99", name: "Por definir" },
];

export const PAYMENT_METHODS: SatItem[] = [
  { code: "PUE", name: "Pago en una sola exhibición" },
  { code: "PPD", name: "Pago en parcialidades o diferido" },
];

export const CURRENCIES: SatItem[] = [
  { code: "MXN", name: "Peso Mexicano" },
  { code: "USD", name: "Dólar estadounidense" },
  { code: "EUR", name: "Euro" },
  { code: "CAD", name: "Dólar canadiense" },
  { code: "GBP", name: "Libra esterlina" },
  { code: "JPY", name: "Yen japonés" },
  { code: "XXX", name: "Los códigos asignados para transacciones sin moneda" },
];

export const EXPORT_CODES: SatItem[] = [
  { code: "01", name: "No aplica" },
  { code: "02", name: "Definitiva con clave A1" },
  { code: "03", name: "Temporal" },
  { code: "04", name: "Definitiva con clave distinta a A1 o cuando no hay enajenación" },
];

export const CFDI_TYPES: SatItem[] = [
  { code: "I", name: "Ingreso" },
  { code: "E", name: "Egreso (Nota de crédito)" },
  { code: "T", name: "Traslado" },
  { code: "N", name: "Nómina" },
  { code: "P", name: "Pago" },
];

export const COUNTRIES: SatItem[] = [
  { code: "MEX", name: "México" },
  { code: "USA", name: "Estados Unidos" },
  { code: "CAN", name: "Canadá" },
  { code: "ESP", name: "España" },
  { code: "ARG", name: "Argentina" },
  { code: "COL", name: "Colombia" },
  { code: "CHL", name: "Chile" },
  { code: "BRA", name: "Brasil" },
  { code: "DEU", name: "Alemania" },
  { code: "FRA", name: "Francia" },
  { code: "GBR", name: "Reino Unido" },
  { code: "JPN", name: "Japón" },
  { code: "CHN", name: "China" },
];

export const COMMON_SAT_KEYS: SatItem[] = [
  { code: "01010101", name: "No existe en el catálogo" },
  { code: "84111506", name: "Servicios de facturación" },
  { code: "80101500", name: "Servicios de consultoría de negocios y administración corporativa" },
  { code: "81111500", name: "Servicios de sistemas y administración de componentes de sistemas" },
  { code: "81112000", name: "Servicios de programación informática" },
  { code: "82101500", name: "Servicios de publicidad" },
  { code: "78111800", name: "Transporte de carga" },
];

export const COMMON_SAT_UNITS: SatItem[] = [
  { code: "E48", name: "Unidad de servicio" },
  { code: "H87", name: "Pieza" },
  { code: "ACT", name: "Actividad" },
  { code: "KGM", name: "Kilogramo" },
  { code: "LTR", name: "Litro" },
  { code: "MTR", name: "Metro" },
  { code: "HUR", name: "Hora" },
  { code: "DAY", name: "Día" },
];

/**
 * Matriz de compatibilidad Régimen fiscal del receptor → Usos de CFDI permitidos.
 * Basada en la "Guía de llenado de CFDI" del SAT (Anexo 20).
 */
export const CFDI_USE_BY_REGIME: Record<string, string[]> = {
  "601": ["G01", "G02", "G03", "I01", "I02", "I03", "I04", "I05", "I06", "I07", "I08", "S01", "CP01"],
  "603": ["G01", "G02", "G03", "I01", "I02", "I03", "I04", "I05", "I06", "I07", "I08", "S01", "CP01"],
  "605": ["CP01", "S01", "D01", "D02", "D03", "D04", "D05", "D06", "D07", "D08", "D09", "D10"],
  "606": ["G01", "G02", "G03", "I01", "I02", "I03", "I04", "I05", "I06", "I07", "I08", "S01", "CP01",
          "D01", "D02", "D03", "D04", "D05", "D06", "D07", "D08", "D09", "D10"],
  "607": ["CP01", "S01", "D04"],
  "608": ["G01", "G02", "G03", "I01", "I02", "I03", "I04", "I05", "I06", "I07", "I08", "S01", "CP01",
          "D01", "D02", "D03", "D04", "D05", "D06", "D07", "D08", "D09", "D10"],
  "610": ["S01", "CP01"],
  "611": ["CP01", "S01", "D04"],
  "612": ["G01", "G02", "G03", "I01", "I02", "I03", "I04", "I05", "I06", "I07", "I08", "S01", "CP01",
          "D01", "D02", "D03", "D04", "D05", "D06", "D07", "D08", "D09", "D10"],
  "614": ["CP01", "S01", "D04"],
  "615": ["CP01", "S01"],
  "616": ["CP01", "S01", "D01", "D02", "D03", "D04", "D05", "D06", "D07", "D08", "D09", "D10"],
  "620": ["G01", "G02", "G03", "I01", "I02", "I03", "I04", "I05", "I06", "I07", "I08", "S01", "CP01"],
  "621": ["G01", "G02", "G03", "I01", "I02", "I03", "I04", "I05", "I06", "I07", "I08", "S01", "CP01"],
  "622": ["G01", "G02", "G03", "I01", "I02", "I03", "I04", "I05", "I06", "I07", "I08", "S01", "CP01"],
  "623": ["G01", "G02", "G03", "I01", "I02", "I03", "I04", "I05", "I06", "I07", "I08", "S01", "CP01"],
  "624": ["G01", "G02", "G03", "I01", "I02", "I03", "I04", "I05", "I06", "I07", "I08", "S01", "CP01"],
  "625": ["G01", "G02", "G03", "I01", "I02", "I03", "I04", "I05", "I06", "I07", "I08", "S01", "CP01",
          "D01", "D02", "D03", "D04", "D05", "D06", "D07", "D08", "D09", "D10"],
  "626": ["G01", "G02", "G03", "I01", "I02", "I03", "I04", "I05", "I06", "I07", "I08", "S01", "CP01",
          "D01", "D02", "D03", "D04", "D05", "D06", "D07", "D08", "D09", "D10"],
};

export function cfdiUsesForRegime(regime: string | null | undefined): SatItem[] {
  if (!regime) return CFDI_USES;
  const allowed = CFDI_USE_BY_REGIME[regime];
  if (!allowed) return CFDI_USES;
  return CFDI_USES.filter((u) => allowed.includes(u.code));
}

export function isCfdiUseCompatible(regime: string | null | undefined, use: string | null | undefined): boolean {
  if (!regime || !use) return true;
  const allowed = CFDI_USE_BY_REGIME[regime];
  if (!allowed) return true;
  return allowed.includes(use);
}
