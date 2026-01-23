import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface DistanceRequest {
  pickupAddress: string;
  deliveryAddress: string;
}

interface DistanceMatrixResult {
  distance: number;
  duration: number;
  pickupAddress: string;
  deliveryAddress: string;
}

async function calculateDistanceWithMatrix(
  pickupAddress: string,
  deliveryAddress: string
): Promise<DistanceMatrixResult | null> {
  const apiKey = Deno.env.get('GOOGLE_MAPS_API_KEY');

  if (!apiKey) {
    console.error('Google Maps API key not configured');
    throw new Error('Google Maps API key not configured. Please check GOOGLE_MAPS_SETUP.md for setup instructions.');
  }

  try {
    const origins = encodeURIComponent(pickupAddress);
    const destinations = encodeURIComponent(deliveryAddress);

    const url = `https://maps.googleapis.com/maps/api/distancematrix/json?origins=${origins}&destinations=${destinations}&mode=driving&key=${apiKey}`;

    const response = await fetch(url);
    const data = await response.json();

    if (data.status !== 'OK') {
      console.error('Distance Matrix API error:', data.status, data.error_message);
      return null;
    }

    if (!data.rows || data.rows.length === 0 || !data.rows[0].elements || data.rows[0].elements.length === 0) {
      console.error('No results from Distance Matrix API');
      return null;
    }

    const element = data.rows[0].elements[0];

    if (element.status !== 'OK') {
      console.error('Distance calculation failed:', element.status);
      return null;
    }

    const distanceInMeters = element.distance.value;
    const distanceInKm = Math.round((distanceInMeters / 1000) * 10) / 10;
    const durationInSeconds = element.duration.value;
    const durationInMinutes = Math.round(durationInSeconds / 60);

    return {
      distance: distanceInKm,
      duration: durationInMinutes,
      pickupAddress: data.origin_addresses[0] || pickupAddress,
      deliveryAddress: data.destination_addresses[0] || deliveryAddress,
    };
  } catch (error) {
    console.error('Distance Matrix API error:', error);
    return null;
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const { pickupAddress, deliveryAddress }: DistanceRequest = await req.json();

    if (!pickupAddress || !deliveryAddress) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: pickupAddress, deliveryAddress' }),
        {
          status: 400,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
          },
        }
      );
    }

    const result = await calculateDistanceWithMatrix(pickupAddress, deliveryAddress);

    if (!result) {
      return new Response(
        JSON.stringify({
          error: 'Unable to find address. Please use detailed addresses with landmarks (e.g., "10 Admiralty Way, near Mega Chicken, Lekki Phase 1, Lagos")'
        }),
        {
          status: 400,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
          },
        }
      );
    }

    return new Response(
      JSON.stringify(result),
      {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );
  } catch (error) {
    console.error('Error calculating distance:', error);

    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const isConfigError = errorMessage.includes('API key not configured');

    return new Response(
      JSON.stringify({
        error: errorMessage,
        hint: isConfigError
          ? 'Please set up Google Maps API key. See GOOGLE_MAPS_SETUP.md for instructions.'
          : 'Please ensure addresses are detailed with area names and landmarks.'
      }),
      {
        status: isConfigError ? 503 : 500,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );
  }
});