import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.58.0";
import { createHmac } from "node:crypto";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, X-Paystack-Signature",
};

interface PaystackChargeEvent {
  event: string;
  data: {
    id: number;
    domain: string;
    status: string;
    reference: string;
    amount: number;
    message: string | null;
    gateway_response: string;
    paid_at: string;
    created_at: string;
    channel: string;
    currency: string;
    ip_address: string;
    metadata: any;
    fees: number;
    customer: {
      id: number;
      first_name: string;
      last_name: string;
      email: string;
      customer_code: string;
      phone: string | null;
      metadata: any;
      risk_action: string;
    };
    authorization: any;
    plan: any;
  };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const paystackSecretKey = Deno.env.get("PAYSTACK_SECRET_KEY");

    if (!paystackSecretKey) {
      throw new Error("PAYSTACK_SECRET_KEY not configured");
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get the signature from headers
    const signature = req.headers.get("x-paystack-signature");
    const body = await req.text();

    // Verify webhook signature
    if (signature) {
      const hash = createHmac("sha512", paystackSecretKey)
        .update(body)
        .digest("hex");

      if (hash !== signature) {
        return new Response(
          JSON.stringify({ error: "Invalid signature" }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    const event: PaystackChargeEvent = JSON.parse(body);

    console.log("Webhook event received:", event.event);

    // Handle charge.success event (for virtual account transfers)
    if (event.event === "charge.success" && event.data.status === "success") {
      const { data } = event;
      const customerCode = data.customer.customer_code;
      const amountInKobo = data.amount;
      const amountInNaira = amountInKobo / 100;
      const reference = data.reference;

      console.log(`Processing payment: ₦${amountInNaira} for customer ${customerCode}`);

      // Find user by customer code
      const { data: virtualAccount, error: accountError } = await supabase
        .from("virtual_accounts")
        .select("user_id")
        .eq("provider_reference", customerCode)
        .maybeSingle();

      if (accountError || !virtualAccount) {
        console.error("Virtual account not found for customer:", customerCode);
        return new Response(
          JSON.stringify({ error: "Virtual account not found" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Check if transaction already processed
      const { data: existingRecharge } = await supabase
        .from("wallet_recharges")
        .select("id")
        .eq("payment_reference", reference)
        .maybeSingle();

      if (existingRecharge) {
        console.log("Transaction already processed:", reference);
        return new Response(
          JSON.stringify({ message: "Transaction already processed" }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Get current wallet balance
      const { data: wallet, error: walletError } = await supabase
        .from("wallets")
        .select("balance")
        .eq("user_id", virtualAccount.user_id)
        .maybeSingle();

      if (walletError) {
        console.error("Error fetching wallet:", walletError);
        throw walletError;
      }

      const currentBalance = wallet?.balance || 0;
      const newBalance = currentBalance + amountInNaira;

      // Update wallet balance
      const { error: updateError } = await supabase
        .from("wallets")
        .upsert({
          user_id: virtualAccount.user_id,
          balance: newBalance,
          updated_at: new Date().toISOString(),
        }, {
          onConflict: "user_id",
        });

      if (updateError) {
        console.error("Error updating wallet:", updateError);
        throw updateError;
      }

      // Record the recharge transaction
      const { error: rechargeError } = await supabase
        .from("wallet_recharges")
        .insert({
          user_id: virtualAccount.user_id,
          amount: amountInNaira,
          payment_method: "transfer",
          payment_reference: reference,
          status: "completed",
          completed_at: data.paid_at,
        });

      if (rechargeError) {
        console.error("Error recording recharge:", rechargeError);
        throw rechargeError;
      }

      console.log(`Wallet credited: ₦${amountInNaira} for user ${virtualAccount.user_id}`);

      return new Response(
        JSON.stringify({ 
          success: true, 
          message: "Wallet credited successfully",
          amount: amountInNaira,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Handle dedicated virtual account assignment
    if (event.event === "dedicatedaccount.assign.success") {
      console.log("Virtual account assigned successfully");
      return new Response(
        JSON.stringify({ message: "Event received" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Default response for other events
    return new Response(
      JSON.stringify({ message: "Event received but not processed" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Webhook error:", error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : "Internal server error" 
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});