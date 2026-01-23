import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ success: false, error: "Unauthorized" }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      {
        global: {
          headers: { Authorization: authHeader },
        },
      }
    );

    const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
    if (authError || !user) {
      return new Response(
        JSON.stringify({ success: false, error: "Unauthorized" }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const { amount } = await req.json();

    if (!amount || amount <= 0) {
      return new Response(
        JSON.stringify({ success: false, error: "Invalid amount. Amount must be greater than 0" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (amount < 100) {
      return new Response(
        JSON.stringify({ success: false, error: "Minimum funding amount is ₦100" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (amount > 1000000) {
      return new Response(
        JSON.stringify({ success: false, error: "Maximum funding amount is ₦1,000,000" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const { data: profile, error: profileError } = await supabaseClient
      .from("profiles")
      .select("email, full_name")
      .eq("id", user.id)
      .maybeSingle();

    if (profileError || !profile) {
      return new Response(
        JSON.stringify({ success: false, error: "User profile not found" }),
        {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const paystackSecretKey = Deno.env.get("PAYSTACK_SECRET_KEY");
    if (!paystackSecretKey) {
      console.error("PAYSTACK_SECRET_KEY not configured");
      return new Response(
        JSON.stringify({ success: false, error: "Payment service configuration error" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const reference = `wallet_${user.id}_${Date.now()}`;
    const amountInKobo = Math.round(amount * 100);

    const { data: rechargeRecord, error: rechargeError } = await supabaseClient
      .from("wallet_recharges")
      .insert({
        user_id: user.id,
        amount: amount,
        reference: reference,
        status: "pending",
      })
      .select()
      .maybeSingle();

    if (rechargeError || !rechargeRecord) {
      console.error("Failed to create recharge record:", rechargeError);
      return new Response(
        JSON.stringify({ success: false, error: "Failed to initialize wallet funding" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const initializeUrl = "https://api.paystack.co/transaction/initialize";
    const initializeResponse = await fetch(initializeUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${paystackSecretKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email: profile.email,
        amount: amountInKobo,
        reference: reference,
        metadata: {
          user_id: user.id,
          full_name: profile.full_name,
          funding_type: "wallet_recharge",
          recharge_id: rechargeRecord.id,
        },
      }),
    });

    const initializeData = await initializeResponse.json();

    if (!initializeResponse.ok || !initializeData.status) {
      await supabaseClient
        .from("wallet_recharges")
        .update({ status: "failed" })
        .eq("id", rechargeRecord.id);

      return new Response(
        JSON.stringify({
          success: false,
          error: "Failed to initialize payment with Paystack",
          details: initializeData.message,
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        authorizationUrl: initializeData.data.authorization_url,
        reference: initializeData.data.reference,
        accessCode: initializeData.data.access_code,
        amount: amount,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: any) {
    console.error("Wallet funding initialization error:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || "An error occurred during wallet funding initialization",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
