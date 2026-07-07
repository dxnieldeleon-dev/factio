import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const inputSchema = z.object({
  companyId: z.string().uuid(),
  password: z.string().min(1).max(512),
});

async function encryptPassword(plaintext: string): Promise<string> {
  const secret = process.env.CSD_ENCRYPTION_KEY;
  if (!secret) throw new Error("CSD_ENCRYPTION_KEY is not configured");

  const enc = new TextEncoder();
  // Derive a 256-bit key from the secret via SHA-256
  const keyMaterial = await crypto.subtle.digest("SHA-256", enc.encode(secret));
  const key = await crypto.subtle.importKey(
    "raw",
    keyMaterial,
    { name: "AES-GCM" },
    false,
    ["encrypt"],
  );

  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = new Uint8Array(
    await crypto.subtle.encrypt(
      { name: "AES-GCM", iv },
      key,
      enc.encode(plaintext),
    ),
  );

  const payload = new Uint8Array(iv.length + ciphertext.length);
  payload.set(iv, 0);
  payload.set(ciphertext, iv.length);

  let binary = "";
  for (let i = 0; i < payload.length; i++) binary += String.fromCharCode(payload[i]);
  return `v1:${btoa(binary)}`;
}

export const saveCsdPassword = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => inputSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    // Verify the company belongs to the current user (RLS also enforces this).
    const { data: company, error: fetchErr } = await supabase
      .from("companies")
      .select("id, user_id")
      .eq("id", data.companyId)
      .maybeSingle();
    if (fetchErr) throw new Error(fetchErr.message);
    if (!company || company.user_id !== userId) {
      throw new Error("Forbidden");
    }

    const encrypted = await encryptPassword(data.password);

    const { error: updateErr } = await supabase
      .from("companies")
      .update({ csd_password_encrypted: encrypted })
      .eq("id", data.companyId);
    if (updateErr) throw new Error(updateErr.message);

    return { ok: true };
  });
