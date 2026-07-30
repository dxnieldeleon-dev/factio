import type { User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export type CompanyProfile = {
  id: string;
  user_id: string;
  legal_name: string;
  trade_name: string | null;
  rfc: string;
  tax_regime: string;
  postal_code: string | null;
  email: string | null;
  phone: string | null;
  csd_cer_url: string | null;
  csd_key_url: string | null;
  csd_serial_number: string | null;
  csd_valid_to: string | null;
  csd_status: string | null;
};

export type CompanyProfileData = {
  user: User;
  company: CompanyProfile | null;
};

export async function loadCompanyProfile(): Promise<CompanyProfileData> {
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError) throw userError;
  if (!userData.user) throw new Error("Tu sesión no está disponible");

  const { data: company, error: companyError } = await supabase
    .from("companies")
    .select(
      "id, user_id, legal_name, trade_name, rfc, tax_regime, postal_code, email, phone, csd_cer_url, csd_key_url, csd_serial_number, csd_valid_to, csd_status",
    )
    .eq("user_id", userData.user.id)
    .maybeSingle();
  if (companyError) throw companyError;

  return { user: userData.user, company: company as CompanyProfile | null };
}

export function isCsdConfigured(company: CompanyProfile | null | undefined) {
  return Boolean(
    company?.csd_cer_url &&
      company.csd_key_url &&
      company.csd_serial_number &&
      company.csd_valid_to &&
      company.csd_status === "uploaded",
  );
}
