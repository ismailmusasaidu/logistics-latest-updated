import { supabase } from './supabase';

export type DeliveryZone = {
  id: string;
  zone_name: string;
  min_distance: number;
  max_distance: number;
  base_price: number;
  is_active: boolean;
};

export type OrderTypeAdjustment = {
  id: string;
  adjustment_name: string;
  adjustment_type: 'flat' | 'percentage';
  adjustment_value: number;
  is_active: boolean;
};

export type OrderSizePricing = {
  id: string;
  size: 'medium' | 'large';
  additional_fee: number;
  is_active: boolean;
};

export type Promotion = {
  id: string;
  code: string;
  promo_code: string;
  promo_name: string;
  discount_type: 'flat' | 'percentage' | 'free_delivery';
  discount_value: number;
  min_order_value: number;
  max_discount: number | null;
  is_active: boolean;
  is_first_order_only: boolean;
  start_date: string;
  end_date: string | null;
  usage_limit: number | null;
  usage_count: number;
};

export type PricingBreakdown = {
  distance: number;
  zoneName: string;
  basePrice: number;
  adjustments: Array<{
    name: string;
    amount: number;
  }>;
  orderSizeFee?: number;
  orderSize?: 'small' | 'medium' | 'large';
  subtotal: number;
  discount: number;
  discountName?: string;
  finalPrice: number;
  promoApplied?: string;
};

export class PricingCalculator {
  private zones: DeliveryZone[] = [];
  private adjustments: OrderTypeAdjustment[] = [];
  private orderSizes: OrderSizePricing[] = [];
  private promotions: Promotion[] = [];

  async initialize() {
    await Promise.all([
      this.loadZones(),
      this.loadAdjustments(),
      this.loadOrderSizes(),
      this.loadPromotions(),
    ]);
  }

  private async loadZones() {
    const { data, error } = await supabase
      .from('delivery_zones')
      .select('*')
      .eq('is_active', true)
      .order('min_distance');

    if (!error && data) {
      this.zones = data;
    }
  }

  private async loadAdjustments() {
    const { data, error } = await supabase
      .from('order_type_adjustments')
      .select('*')
      .eq('is_active', true);

    if (!error && data) {
      this.adjustments = data;
    }
  }

  private async loadOrderSizes() {
    const { data, error } = await supabase
      .from('order_size_pricing')
      .select('*')
      .eq('is_active', true);

    if (!error && data) {
      this.orderSizes = data;
    }
  }

  private async loadPromotions() {
    const { data, error } = await supabase
      .from('promotions')
      .select('*')
      .eq('is_active', true);

    if (!error && data) {
      this.promotions = data.filter(promo => {
        const now = new Date();
        const startDate = new Date(promo.start_date);
        const endDate = promo.end_date ? new Date(promo.end_date) : null;

        const isWithinDateRange =
          now >= startDate &&
          (!endDate || now <= endDate);

        const hasUsageAvailable =
          !promo.usage_limit ||
          promo.usage_count < promo.usage_limit;

        return isWithinDateRange && hasUsageAvailable;
      });
    }
  }

  findZoneForDistance(distance: number): DeliveryZone | null {
    return this.zones.find(zone =>
      distance >= zone.min_distance && distance < zone.max_distance
    ) || null;
  }

  getAdjustmentByName(name: string): OrderTypeAdjustment | null {
    return this.adjustments.find(adj =>
      adj.adjustment_name.toLowerCase() === name.toLowerCase()
    ) || null;
  }

  getOrderSizeFee(size: 'small' | 'medium' | 'large' | ''): number {
    if (!size || size === 'small') {
      return 0;
    }

    const sizeConfig = this.orderSizes.find(s => s.size === size);
    return sizeConfig ? sizeConfig.additional_fee : 0;
  }

  async validatePromoCode(
    promoCode: string,
    customerId: string,
    orderValue: number
  ): Promise<Promotion | null> {
    const promo = this.promotions.find(p =>
      p.promo_code.toUpperCase() === promoCode.toUpperCase()
    );

    if (!promo) {
      return null;
    }

    if (orderValue < promo.min_order_value) {
      return null;
    }

    if (promo.is_first_order_only) {
      const { count } = await supabase
        .from('orders')
        .select('id', { count: 'exact', head: true })
        .eq('customer_id', customerId)
        .eq('status', 'completed');

      if (count && count > 0) {
        return null;
      }
    }

    return promo;
  }

  calculateDeliveryPrice(
    distance: number,
    orderTypeAdjustments: string[] = [],
    orderValue: number = 0,
    promotion?: Promotion | null,
    orderSize?: 'small' | 'medium' | 'large' | ''
  ): PricingBreakdown {
    const zone = this.findZoneForDistance(distance);

    if (!zone) {
      throw new Error(`No delivery zone found for distance: ${distance}km`);
    }

    let basePrice = zone.base_price;
    const adjustmentsList: Array<{ name: string; amount: number }> = [];

    for (const adjustmentName of orderTypeAdjustments) {
      const adjustment = this.getAdjustmentByName(adjustmentName);
      if (adjustment) {
        let adjustmentAmount = 0;

        if (adjustment.adjustment_type === 'flat') {
          adjustmentAmount = adjustment.adjustment_value;
        } else if (adjustment.adjustment_type === 'percentage') {
          adjustmentAmount = (basePrice * adjustment.adjustment_value) / 100;
        }

        adjustmentsList.push({
          name: adjustment.adjustment_name,
          amount: adjustmentAmount,
        });
      }
    }

    const adjustmentsTotal = adjustmentsList.reduce((sum, adj) => sum + adj.amount, 0);
    const orderSizeFee = this.getOrderSizeFee(orderSize || '');
    const subtotal = basePrice + adjustmentsTotal + orderSizeFee;

    let discount = 0;
    let discountName: string | undefined;
    let promoApplied: string | undefined;

    if (promotion) {
      if (promotion.discount_type === 'free_delivery') {
        discount = subtotal;
        discountName = 'Free Delivery';
      } else if (promotion.discount_type === 'flat') {
        discount = Math.min(promotion.discount_value, subtotal);
      } else if (promotion.discount_type === 'percentage') {
        discount = (subtotal * promotion.discount_value) / 100;
        if (promotion.max_discount) {
          discount = Math.min(discount, promotion.max_discount);
        }
      }

      promoApplied = promotion.promo_code;
      discountName = promotion.promo_name;
    }

    const finalPrice = Math.max(0, subtotal - discount);

    return {
      distance,
      zoneName: zone.zone_name,
      basePrice,
      adjustments: adjustmentsList,
      orderSizeFee: orderSizeFee > 0 ? orderSizeFee : undefined,
      orderSize: orderSize || undefined,
      subtotal,
      discount,
      discountName,
      finalPrice,
      promoApplied,
    };
  }

  async incrementPromoUsage(promoCode: string): Promise<void> {
    const { error } = await supabase.rpc('increment_promo_usage', {
      p_promo_code: promoCode,
    });

    if (error) {
      console.error('Failed to increment promo usage:', error);
    }
  }
}

export const pricingCalculator = new PricingCalculator();

export function simulateDistanceCalculation(
  pickupLat: number,
  pickupLng: number,
  deliveryLat: number,
  deliveryLng: number
): number {
  const R = 6371;
  const dLat = ((deliveryLat - pickupLat) * Math.PI) / 180;
  const dLng = ((deliveryLng - pickupLng) * Math.PI) / 180;

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((pickupLat * Math.PI) / 180) *
      Math.cos((deliveryLat * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c;

  return Math.round(distance * 10) / 10;
}

export function formatCurrency(amount: number): string {
  return `₦${amount.toLocaleString('en-NG', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}
