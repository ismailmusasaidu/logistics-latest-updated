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
    const { reference } = await req.json();

    if (!reference) {
      return new Response(
        JSON.stringify({ success: false, error: "Payment reference is required" }),
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

    const verifyUrl = `https://api.paystack.co/transaction/verify/${reference}`;
    const verifyResponse = await fetch(verifyUrl, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${paystackSecretKey}`,
        "Content-Type": "application/json",
      },
    });

    const verifyData = await verifyResponse.json();

    if (!verifyResponse.ok || !verifyData.status) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Payment verification failed",
          details: verifyData.message,
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const transactionData = verifyData.data;

    if (transactionData.status !== "success") {
      let errorMessage = "Payment was not successful";

      switch (transactionData.status) {
        case "failed":
          errorMessage = transactionData.gateway_response || "Payment failed. Please try again.";
          break;
        case "abandoned":
          errorMessage = "Payment was abandoned. Please try again.";
          break;
        case "cancelled":
          errorMessage = "Payment was cancelled.";
          break;
        default:
          errorMessage = `Payment status: ${transactionData.status}`;
      }

      return new Response(
        JSON.stringify({
          success: false,
          verified: false,
          status: transactionData.status,
          message: errorMessage,
          gatewayResponse: transactionData.gateway_response,
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        verified: true,
        amount: transactionData.amount / 100,
        reference: transactionData.reference,
        status: transactionData.status,
        paidAt: transactionData.paid_at,
        metadata: transactionData.metadata,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: any) {
    console.error("Payment verification error:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || "An error occurred during payment verification",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
