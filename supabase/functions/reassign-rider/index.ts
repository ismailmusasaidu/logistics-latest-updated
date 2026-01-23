import { createClient } from 'npm:@supabase/supabase-js@2.58.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

interface ReassignRiderRequest {
  order_id: string;
  reason?: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { order_id, reason }: ReassignRiderRequest = await req.json();

    if (!order_id) {
      return new Response(
        JSON.stringify({ error: 'order_id is required' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Fetch order details
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('id, pickup_zone_id, assignment_status, assigned_rider_id')
      .eq('id', order_id)
      .maybeSingle();

    if (orderError || !order) {
      return new Response(
        JSON.stringify({ error: 'Order not found', details: orderError }),
        {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Skip if already accepted
    if (order.assignment_status === 'accepted') {
      return new Response(
        JSON.stringify({
          success: false,
          message: 'Order already accepted by a rider',
        }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // If no zone assigned yet, we can't auto-assign
    if (!order.pickup_zone_id) {
      return new Response(
        JSON.stringify({
          success: false,
          message: 'Order has no pickup zone assigned. Cannot reassign rider.',
        }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Get the current assigned rider to exclude from next search
    const excludeRiderId = order.assigned_rider_id;

    // Find available riders in the same zone (excluding the one who rejected)
    let query = supabase
      .from('riders')
      .select('id, active_orders, zone_id')
      .eq('status', 'online')
      .eq('zone_id', order.pickup_zone_id)
      .lt('active_orders', 10)
      .order('active_orders', { ascending: true })
      .limit(1);

    // Exclude the rider who just rejected or timed out
    if (excludeRiderId) {
      query = query.neq('id', excludeRiderId);
    }

    const { data: riders, error: ridersError } = await query;

    if (ridersError) {
      return new Response(
        JSON.stringify({ error: 'Failed to fetch riders', details: ridersError }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    if (!riders || riders.length === 0) {
      // No more riders available - reset assignment
      const { error: resetError } = await supabase
        .from('orders')
        .update({
          assigned_rider_id: null,
          assignment_status: 'pending',
          assigned_at: null,
          assignment_timeout_at: null,
        })
        .eq('id', order_id);

      if (resetError) {
        console.error('Failed to reset order assignment:', resetError);
      }

      return new Response(
        JSON.stringify({
          success: false,
          message: 'No more available riders found in the zone. Order reset to pending.',
        }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const selectedRider = riders[0];

    // Calculate new timeout (30 seconds from now)
    const timeoutAt = new Date();
    timeoutAt.setSeconds(timeoutAt.getSeconds() + 30);

    // Reassign rider to order
    const { error: updateError } = await supabase
      .from('orders')
      .update({
        assigned_rider_id: selectedRider.id,
        assignment_status: 'assigned',
        assigned_at: new Date().toISOString(),
        assignment_timeout_at: timeoutAt.toISOString(),
      })
      .eq('id', order_id);

    if (updateError) {
      return new Response(
        JSON.stringify({ error: 'Failed to reassign rider', details: updateError }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Rider reassigned successfully',
        rider_id: selectedRider.id,
        timeout_at: timeoutAt.toISOString(),
        reason: reason || 'Previous rider rejected or timed out',
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error: any) {
    console.error('Error in reassign-rider:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
