import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import Stripe from "npm:stripe@17";

const stripeSecretKey = Deno.env.get("STRIPE_SECRET_KEY")!;
const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET")!;
const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const stripe = new Stripe(stripeSecretKey, { apiVersion: "2024-06-20" });
const admin = createClient(supabaseUrl, serviceRoleKey);

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

// El plan puede coincidir por su price_id de modo live o de modo test —
// así el webhook funciona sin importar en qué modo se generó el evento.
async function getPlanByPriceId(priceId: string) {
  const { data } = await admin
    .from("plans")
    .select("id, facturas_incluidas")
    .or(`stripe_price_id.eq.${priceId},stripe_price_id_test.eq.${priceId}`)
    .maybeSingle();
  return data;
}

async function upsertSubscriptionFromStripe(sub: Stripe.Subscription, companyIdHint?: string) {
  const priceId = sub.items.data[0]?.price?.id;
  const plan = priceId ? await getPlanByPriceId(priceId) : null;

  let companyId = companyIdHint;
  if (!companyId) {
    const { data: existing } = await admin
      .from("subscriptions")
      .select("company_id")
      .eq("stripe_subscription_id", sub.id)
      .maybeSingle();
    companyId = existing?.company_id;
  }
  if (!companyId) return null;

  const { data: row } = await admin
    .from("subscriptions")
    .upsert(
      {
        company_id: companyId,
        plan_id: plan?.id,
        stripe_customer_id: typeof sub.customer === "string" ? sub.customer : sub.customer.id,
        stripe_subscription_id: sub.id,
        status: sub.status,
        current_period_start: new Date(sub.current_period_start * 1000).toISOString(),
        current_period_end: new Date(sub.current_period_end * 1000).toISOString(),
        cancel_at_period_end: sub.cancel_at_period_end,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "company_id" },
    )
    .select()
    .single();
  return row;
}

async function grantForInvoice(invoice: Stripe.Invoice) {
  const subId = typeof invoice.subscription === "string" ? invoice.subscription : invoice.subscription?.id;
  if (!subId) return;

  const { data: subRow } = await admin
    .from("subscriptions")
    .select("id, company_id, plan_id")
    .eq("stripe_subscription_id", subId)
    .maybeSingle();
  if (!subRow) return;

  const priceId = invoice.lines.data[0]?.price?.id;
  const plan = priceId ? await getPlanByPriceId(priceId) : null;
  const facturasIncluidas = plan?.facturas_incluidas;
  if (!facturasIncluidas) return;

  const { data: wallet } = await admin
    .from("stamp_wallets")
    .select("balance")
    .eq("company_id", subRow.company_id)
    .maybeSingle();
  const currentBalance = wallet?.balance ?? 0;

  if (currentBalance > 0) {
    await admin.from("stamp_transactions").insert({
      company_id: subRow.company_id,
      subscription_id: subRow.id,
      type: "perdida_vencimiento",
      amount: -currentBalance,
      reference_id: `${invoice.id}_expiry`,
    });
  }

  await admin.from("stamp_transactions").insert({
    company_id: subRow.company_id,
    subscription_id: subRow.id,
    type: "grant_renovacion",
    amount: facturasIncluidas,
    reference_id: invoice.id,
  });
}

Deno.serve(async (req: Request) => {
  const signature = req.headers.get("stripe-signature");
  const rawBody = await req.text();

  if (!signature) {
    return json({ error: "Falta firma de Stripe." }, 400);
  }

  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(rawBody, signature, webhookSecret);
  } catch (err) {
    return json({ error: `Firma inválida: ${(err as Error).message}` }, 400);
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const companyId = session.client_reference_id ?? undefined;
        const subscriptionId = typeof session.subscription === "string" ? session.subscription : session.subscription?.id;
        if (companyId && subscriptionId) {
          const sub = await stripe.subscriptions.retrieve(subscriptionId);
          await upsertSubscriptionFromStripe(sub, companyId);
        }
        break;
      }
      case "customer.subscription.created":
      case "customer.subscription.updated": {
        const sub = event.data.object as Stripe.Subscription;
        await upsertSubscriptionFromStripe(sub);
        break;
      }
      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;
        await admin.from("subscriptions").update({ status: "canceled", updated_at: new Date().toISOString() }).eq("stripe_subscription_id", sub.id);
        break;
      }
      case "invoice.paid": {
        const invoice = event.data.object as Stripe.Invoice;
        await grantForInvoice(invoice);
        break;
      }
      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        const subId = typeof invoice.subscription === "string" ? invoice.subscription : invoice.subscription?.id;
        if (subId) {
          await admin.from("subscriptions").update({ status: "past_due", updated_at: new Date().toISOString() }).eq("stripe_subscription_id", subId);
        }
        break;
      }
      default:
        break;
    }
    return json({ received: true }, 200);
  } catch (err) {
    console.error("stripe-webhook error", err);
    return json({ error: "Error interno procesando el evento." }, 500);
  }
});
