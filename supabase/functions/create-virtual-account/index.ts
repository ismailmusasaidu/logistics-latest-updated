import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.58.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface PaystackVirtualAccountResponse {
  status: boolean;
  message: string;
  data: {
    bank: {
      name: string;
      id: number;
      slug: string;
    };
    account_name: string;
    account_number: string;
    assigned: boolean;
    currency: string;
    metadata: any;
    active: boolean;
    id: number;
    created_at: string;
    updated_at: string;
    assignment: {
      integration: number;
      assignee_id: number;
      assignee_type: string;
      expired: boolean;
      account_type: string;
      assigned_at: string;
    };
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

    const authHeader = req.headers.get("Authorization")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      global: { headers: { Authorization: authHeader } },
    });

    // Get authenticated user
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if user already has a virtual account
    const { data: existingAccount } = await supabase
      .from("virtual_accounts")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle();

    if (existingAccount) {
      return new Response(
        JSON.stringify({ 
          success: true, 
          data: existingAccount,
          message: "Virtual account already exists" 
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get user profile
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("full_name, email, phone")
      .eq("id", user.id)
      .single();

    if (profileError || !profile) {
      return new Response(
        JSON.stringify({ error: "Profile not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Split full name into first and last name
    const nameParts = (profile.full_name || "Customer User").split(" ");
    const firstName = nameParts[0] || "Customer";
    const lastName = nameParts.slice(1).join(" ") || "User";

    // Create customer on Paystack first
    const customerPayload = {
      email: profile.email,
      first_name: firstName,
      last_name: lastName,
      phone: profile.phone || undefined,
    };

    const customerResponse = await fetch("https://api.paystack.co/customer", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${paystackSecretKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(customerPayload),
    });

    const customerResult = await customerResponse.json();
    if (!customerResult.status) {
      // Customer might already exist, try to fetch
      const fetchResponse = await fetch(
        `https://api.paystack.co/customer/${encodeURIComponent(profile.email)}`,
        {
          headers: { "Authorization": `Bearer ${paystackSecretKey}` },
        }
      );
      const fetchResult = await fetchResponse.json();
      if (!fetchResult.status) {
        throw new Error(fetchResult.message || "Failed to create/fetch customer");
      }
      customerResult.data = fetchResult.data;
    }

    const customerCode = customerResult.data.customer_code;

    // Create dedicated virtual account
    const accountPayload = {
      customer: customerCode,
      preferred_bank: "wema-bank",
    };

    const accountResponse = await fetch(
      "https://api.paystack.co/dedicated_account",
      {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${paystackSecretKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(accountPayload),
      }
    );

    const accountResult: PaystackVirtualAccountResponse = await accountResponse.json();

    if (!accountResult.status) {
      throw new Error(accountResult.message || "Failed to create virtual account");
    }

    // Save to database
    const { data: virtualAccount, error: insertError } = await supabase
      .from("virtual_accounts")
      .insert({
        user_id: user.id,
        account_number: accountResult.data.account_number,
        account_name: accountResult.data.account_name,
        bank_name: accountResult.data.bank.name,
        bank_code: accountResult.data.bank.slug,
        provider: "paystack",
        provider_reference: customerCode,
        is_active: accountResult.data.active,
      })
      .select()
      .single();

    if (insertError) {
      throw insertError;
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        data: virtualAccount,
        message: "Virtual account created successfully" 
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error creating virtual account:", error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : "Internal server error" 
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});