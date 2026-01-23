const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

export type DistanceResult = {
  distance: number;
  duration: number;
  pickupAddress: string;
  deliveryAddress: string;
};

export async function calculateDistanceBetweenAddresses(
  pickupAddress: string,
  deliveryAddress: string
): Promise<DistanceResult | null> {
  if (!pickupAddress || !deliveryAddress) {
    return null;
  }

  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    console.error('Supabase configuration not found');
    return null;
  }

  try {
    const origins = pickupAddress.includes('Nigeria')
      ? pickupAddress
      : `${pickupAddress}, Nigeria`;
    const destinations = deliveryAddress.includes('Nigeria')
      ? deliveryAddress
      : `${deliveryAddress}, Nigeria`;

    const response = await fetch(
      `${SUPABASE_URL}/functions/v1/calculate-distance`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          pickupAddress: origins,
          deliveryAddress: destinations,
        }),
      }
    );

    if (!response.ok) {
      const errorData = await response.json();
      console.error('Distance calculation error:', errorData.error);
      throw new Error(errorData.error || 'Failed to calculate distance');
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Distance calculation error:', error);
    return null;
  }
}
