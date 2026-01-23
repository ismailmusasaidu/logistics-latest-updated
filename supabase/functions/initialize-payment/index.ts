import "jsr:@supabase/functions-js/edge-runtime.d.ts";

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
    const { email, amount, orderId, metadata } = await req.json();

    if (!email || !amount) {
      return new Response(
        JSON.stringify({ success: false, error: "Email and amount are required" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const paystackSecretKey = Deno.env.get("PAYSTACK_SECRET_KEY");
    if (!paystackSecretKey) {
      return new Response(
        JSON.stringify({ success: false, error: "Payment configuration error" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const amountInKobo = Math.round(amount * 100);

    const initializeUrl = "https://api.paystack.co/transaction/initialize";
    const initializeResponse = await fetch(initializeUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${paystackSecretKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email,
        amount: amountInKobo,
        reference: orderId,
        metadata: {
          ...metadata,
          orderId,
        },
      }),
    });

    const initializeData = await initializeResponse.json();

    if (!initializeResponse.ok || !initializeData.status) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Failed to initialize payment",
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
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: any) {
    console.error("Payment initialization error:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || "An error occurred during payment initialization",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
