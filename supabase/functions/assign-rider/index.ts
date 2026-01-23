import { createClient } from 'npm:@supabase/supabase-js@2.58.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

interface AssignRiderRequest {
  order_id: string;
}

interface Zone {
  id: string;
  name: string;
  description: string | null;
}

async function findClosestZoneUsingDistance(
  pickupAddress: string,
  zones: Zone[]
): Promise<string | null> {
  const apiKey = Deno.env.get('GOOGLE_MAPS_API_KEY');

  if (!apiKey) {
    console.error('Google Maps API key not configured');
    return null;
  }

  try {
    const origin = encodeURIComponent(
      pickupAddress.includes('Nigeria') ? pickupAddress : `${pickupAddress}, Nigeria`
    );

    const destinations = zones
      .map(zone => encodeURIComponent(`${zone.name}, Nigeria`))
      .join('|');

    const url = `https://maps.googleapis.com/maps/api/distancematrix/json?origins=${origin}&destinations=${destinations}&mode=driving&key=${apiKey}`;

    const response = await fetch(url);
    const data = await response.json();

    if (data.status !== 'OK') {
      console.error('Distance Matrix API error:', data.status, data.error_message);
      return null;
    }

    if (!data.rows || data.rows.length === 0 || !data.rows[0].elements) {
      console.error('No results from Distance Matrix API');
      return null;
    }

    const elements = data.rows[0].elements;
    let closestZoneId: string | null = null;
    let shortestDistance = Infinity;

    for (let i = 0; i < elements.length; i++) {
      const element = elements[i];
      if (element.status === 'OK' && element.distance) {
        const distanceInMeters = element.distance.value;
        if (distanceInMeters < shortestDistance) {
          shortestDistance = distanceInMeters;
          closestZoneId = zones[i].id;
        }
      }
    }

    if (closestZoneId) {
      console.log(`Closest zone found: ${zones.find(z => z.id === closestZoneId)?.name} at ${(shortestDistance / 1000).toFixed(2)}km`);
    }

    return closestZoneId;
  } catch (error) {
    console.error('Error finding closest zone:', error);
    return null;
  }
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

    const { order_id }: AssignRiderRequest = await req.json();

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
      .select('id, pickup_zone_id, pickup_address, assignment_status, assigned_rider_id')
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

    // Skip if already assigned and accepted
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

    let targetZoneId = order.pickup_zone_id;

    // If no zone assigned, use Google Distance Matrix to find closest zone
    if (!targetZoneId) {
      console.log('No zone assigned, calculating closest zone using Google Distance Matrix...');

      const { data: zones, error: zonesError } = await supabase
        .from('zones')
        .select('id, name, description')
        .eq('is_active', true);

      if (zonesError || !zones || zones.length === 0) {
        return new Response(
          JSON.stringify({
            success: false,
            message: 'No active zones found in the system',
          }),
          {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }

      targetZoneId = await findClosestZoneUsingDistance(order.pickup_address, zones);

      if (!targetZoneId) {
        return new Response(
          JSON.stringify({
            success: false,
            message: 'Could not determine closest zone. Please check Google Maps API configuration.',
          }),
          {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }

      // Update order with the calculated zone
      await supabase
        .from('orders')
        .update({ pickup_zone_id: targetZoneId })
        .eq('id', order_id);

      console.log(`Updated order ${order_id} with zone ${targetZoneId}`);
    }

    // Find available riders in the target zone
    const { data: riders, error: ridersError } = await supabase
      .from('riders')
      .select('id, active_orders, zone_id')
      .eq('status', 'online')
      .eq('zone_id', targetZoneId)
      .lt('active_orders', 3)
      .order('active_orders', { ascending: true })
      .limit(1);

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
      return new Response(
        JSON.stringify({
          success: false,
          message: 'No available riders found in the zone',
        }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const selectedRider = riders[0];

    // Calculate timeout (30 seconds from now)
    const timeoutAt = new Date();
    timeoutAt.setSeconds(timeoutAt.getSeconds() + 30);

    // Assign rider to order
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
        JSON.stringify({ error: 'Failed to assign rider', details: updateError }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Rider assigned successfully',
        rider_id: selectedRider.id,
        zone_id: targetZoneId,
        timeout_at: timeoutAt.toISOString(),
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error: any) {
    console.error('Error in assign-rider:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
