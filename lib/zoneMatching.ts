import { supabase } from './supabase';

interface Zone {
  id: string;
  name: string;
  description: string | null;
  is_active: boolean;
}

export async function matchAddressToZone(address: string): Promise<string | null> {
  try {
    const { data: zones, error } = await supabase
      .from('zones')
      .select('id, name, description, is_active')
      .eq('is_active', true);

    if (error || !zones || zones.length === 0) {
      return null;
    }

    const normalizedAddress = address.toLowerCase().trim();

    for (const zone of zones) {
      const zoneName = zone.name.toLowerCase();
      const zoneDescription = zone.description?.toLowerCase() || '';

      if (
        normalizedAddress.includes(zoneName) ||
        (zoneDescription && normalizedAddress.includes(zoneDescription))
      ) {
        return zone.id;
      }

      const zoneWords = zoneName.split(/\s+/);
      const hasAllZoneWords = zoneWords.every(word =>
        normalizedAddress.includes(word)
      );

      if (hasAllZoneWords && zoneWords.length > 1) {
        return zone.id;
      }
    }

    return null;
  } catch (error) {
    console.error('Error matching address to zone:', error);
    return null;
  }
}

export async function getAllZones(): Promise<Zone[]> {
  try {
    const { data, error } = await supabase
      .from('zones')
      .select('id, name, description, is_active')
      .eq('is_active', true)
      .order('name');

    if (error) {
      console.error('Error fetching zones:', error);
      return [];
    }

    return data || [];
  } catch (error) {
    console.error('Error fetching zones:', error);
    return [];
  }
}
