import { View, Text, StyleSheet } from 'react-native';
import { MapPin, Plus, Minus, DollarSign } from 'lucide-react-native';
import { PricingBreakdown as PricingBreakdownType, formatCurrency } from '@/lib/pricingCalculator';

type Props = {
  breakdown: PricingBreakdownType;
};

export function PricingBreakdown({ breakdown }: Props) {
  const isBulkOrder = 'bulkDiscount' in breakdown;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <DollarSign size={20} color="#f97316" />
        <Text style={styles.headerTitle}>
          {isBulkOrder ? 'Bulk Order Breakdown' : 'Delivery Charge Breakdown'}
        </Text>
      </View>

      <View style={styles.section}>
        {!isBulkOrder && breakdown.distance !== undefined && (
          <View style={styles.row}>
            <View style={styles.labelContainer}>
              <MapPin size={16} color="#6b7280" />
              <Text style={styles.label}>Distance</Text>
            </View>
            <Text style={styles.value}>{breakdown.distance} km</Text>
          </View>
        )}

        {!isBulkOrder && breakdown.zoneName && (
          <View style={styles.row}>
            <Text style={styles.label}>Zone: {breakdown.zoneName}</Text>
            <Text style={styles.value}>{formatCurrency(breakdown.basePrice)}</Text>
          </View>
        )}

        {isBulkOrder && (
          <View style={styles.row}>
            <Text style={styles.label}>Base Delivery Fee</Text>
            <Text style={styles.value}>{formatCurrency(breakdown.basePrice)}</Text>
          </View>
        )}
      </View>

      {breakdown.adjustments.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Additional Charges</Text>
          {breakdown.adjustments.map((adjustment, index) => (
            <View key={index} style={styles.row}>
              <View style={styles.labelContainer}>
                <Plus size={14} color="#f59e0b" />
                <Text style={styles.adjustmentLabel}>{adjustment.name}</Text>
              </View>
              <Text style={styles.adjustmentValue}>+{formatCurrency(adjustment.amount)}</Text>
            </View>
          ))}
        </View>
      )}

      {breakdown.orderSizeFee && breakdown.orderSizeFee > 0 && (
        <View style={styles.section}>
          <View style={styles.row}>
            <View style={styles.labelContainer}>
              <Plus size={14} color="#f59e0b" />
              <Text style={styles.adjustmentLabel}>
                {breakdown.orderSize?.charAt(0).toUpperCase()}{breakdown.orderSize?.slice(1)} Order Size
              </Text>
            </View>
            <Text style={styles.adjustmentValue}>+{formatCurrency(breakdown.orderSizeFee)}</Text>
          </View>
        </View>
      )}

      {(breakdown.adjustments && breakdown.adjustments.length > 0) || (breakdown.orderSizeFee && breakdown.orderSizeFee > 0) ? (
        <View style={styles.subtotalRow}>
          <Text style={styles.subtotalLabel}>Subtotal</Text>
          <Text style={styles.subtotalValue}>{formatCurrency(breakdown.subtotal)}</Text>
        </View>
      ) : null}

      {isBulkOrder && (breakdown as any).bulkDiscount > 0 && (
        <View style={styles.discountSection}>
          <View style={styles.row}>
            <View style={styles.labelContainer}>
              <Minus size={14} color="#f97316" />
              <Text style={styles.discountLabel}>Bulk Order Discount</Text>
            </View>
            <Text style={styles.discountValue}>-{formatCurrency((breakdown as any).bulkDiscount)}</Text>
          </View>
        </View>
      )}

      {!isBulkOrder && breakdown.discount > 0 && (
        <View style={styles.discountSection}>
          <View style={styles.row}>
            <View style={styles.labelContainer}>
              <Minus size={14} color="#f97316" />
              <Text style={styles.discountLabel}>{breakdown.discountName}</Text>
            </View>
            <Text style={styles.discountValue}>-{formatCurrency(breakdown.discount)}</Text>
          </View>
          {breakdown.promoApplied && (
            <Text style={styles.promoCode}>Code: {breakdown.promoApplied}</Text>
          )}
        </View>
      )}

      {isBulkOrder && (breakdown as any).promoDiscount > 0 && (
        <View style={styles.discountSection}>
          <View style={styles.row}>
            <View style={styles.labelContainer}>
              <Minus size={14} color="#f97316" />
              <Text style={styles.discountLabel}>Promo Code Discount</Text>
            </View>
            <Text style={styles.discountValue}>-{formatCurrency((breakdown as any).promoDiscount)}</Text>
          </View>
          {(breakdown as any).promotion && (
            <Text style={styles.promoCode}>Code: {(breakdown as any).promotion.code}</Text>
          )}
        </View>
      )}

      <View style={styles.totalRow}>
        <Text style={styles.totalLabel}>Total Delivery Fee</Text>
        <Text style={styles.totalValue}>{formatCurrency(breakdown.finalPrice)}</Text>
      </View>

      {breakdown.finalPrice === 0 && (
        <View style={styles.freeDeliveryBanner}>
          <Text style={styles.freeDeliveryText}>🎉 Free Delivery Applied!</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
  },
  section: {
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6b7280',
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
  },
  labelContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  label: {
    fontSize: 14,
    color: '#6b7280',
  },
  value: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
  },
  adjustmentLabel: {
    fontSize: 14,
    color: '#f59e0b',
  },
  adjustmentValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#f59e0b',
  },
  subtotalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    marginTop: 4,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  subtotalLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6b7280',
  },
  subtotalValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6b7280',
  },
  discountSection: {
    backgroundColor: '#f0fdf4',
    borderRadius: 8,
    padding: 12,
    marginVertical: 8,
  },
  discountLabel: {
    fontSize: 14,
    color: '#f97316',
    fontWeight: '600',
  },
  discountValue: {
    fontSize: 14,
    fontWeight: '700',
    color: '#f97316',
  },
  promoCode: {
    fontSize: 12,
    color: '#f97316',
    marginTop: 4,
    fontWeight: '600',
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    marginTop: 8,
    borderTopWidth: 2,
    borderTopColor: '#f97316',
    backgroundColor: '#f0fdf4',
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  totalLabel: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
  },
  totalValue: {
    fontSize: 20,
    fontWeight: '800',
    color: '#f97316',
  },
  freeDeliveryBanner: {
    backgroundColor: '#f97316',
    borderRadius: 8,
    padding: 12,
    marginTop: 12,
    alignItems: 'center',
  },
  freeDeliveryText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#ffffff',
  },
});
