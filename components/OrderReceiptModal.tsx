import { View, Text, StyleSheet, Modal, TouchableOpacity, ScrollView, Platform } from 'react-native';
import { X, Download, Printer } from 'lucide-react-native';
import { Fonts } from '@/constants/fonts';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

type Order = {
  id: string;
  order_number: string;
  pickup_address: string;
  delivery_address: string;
  recipient_name: string;
  recipient_phone: string;
  package_description: string;
  delivery_instructions?: string;
  pickup_instructions?: string;
  delivery_fee: number;
  payment_method: string;
  payment_status: string;
  status: string;
  created_at: string;
  scheduled_delivery_time?: string;
  order_size?: string;
  order_types?: string[];
};

type ReceiptProps = {
  visible: boolean;
  onClose: () => void;
  orderId: string;
};

export function OrderReceiptModal({ visible, onClose, orderId }: ReceiptProps) {
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (visible && orderId) {
      fetchOrderDetails();
    }
  }, [visible, orderId]);

  const fetchOrderDetails = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('orders')
        .select('*')
        .eq('id', orderId)
        .single();

      if (error) throw error;
      setOrder(data);
    } catch (error) {
      console.error('Error fetching order:', error);
    } finally {
      setLoading(false);
    }
  };

  const handlePrint = () => {
    if (Platform.OS === 'web' && order) {
      generatePrintableReceipt();
    }
  };

  const handleDownload = () => {
    if (Platform.OS === 'web' && order) {
      generatePDF();
    }
  };

  const generatePDF = async () => {
    if (!order || Platform.OS !== 'web') return;

    const jsPDF = (await import('jspdf')).default;
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
    });

    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 20;
    const maxWidth = pageWidth - (margin * 2);
    let yPos = 20;

    doc.setFont('courier', 'bold');
    doc.setFontSize(18);
    doc.text('DANHAUSA LOGISTICS', pageWidth / 2, yPos, { align: 'center' });
    yPos += 6;

    doc.setFont('courier', 'normal');
    doc.setFontSize(10);
    doc.text('info@danhausalogistics.com', pageWidth / 2, yPos, { align: 'center' });
    yPos += 5;
    doc.text('danhausalogistics.com', pageWidth / 2, yPos, { align: 'center' });
    yPos += 10;

    doc.setLineWidth(0.5);
    doc.line(margin, yPos, pageWidth - margin, yPos);
    yPos += 8;

    doc.setFont('courier', 'bold');
    doc.setFontSize(14);
    doc.text('ORDER RECEIPT', pageWidth / 2, yPos, { align: 'center' });
    yPos += 10;

    doc.line(margin, yPos, pageWidth - margin, yPos);
    yPos += 8;

    doc.setFont('courier', 'normal');
    doc.setFontSize(10);
    doc.text('Order Number:', margin, yPos);
    doc.setFont('courier', 'bold');
    doc.text(order.order_number, pageWidth - margin, yPos, { align: 'right' });
    yPos += 6;

    doc.setFont('courier', 'normal');
    doc.text('Date:', margin, yPos);
    doc.setFont('courier', 'bold');
    doc.text(formatDate(order.created_at), pageWidth - margin, yPos, { align: 'right' });
    yPos += 6;

    doc.setFont('courier', 'normal');
    doc.text('Status:', margin, yPos);
    doc.setFont('courier', 'bold');
    doc.text(order.status.toUpperCase(), pageWidth - margin, yPos, { align: 'right' });
    yPos += 10;

    doc.setLineWidth(0.5);
    doc.line(margin, yPos, pageWidth - margin, yPos);
    yPos += 8;

    doc.setFont('courier', 'bold');
    doc.setFontSize(11);
    doc.text('DELIVERY DETAILS', margin, yPos);
    yPos += 8;

    doc.setFont('courier', 'bold');
    doc.setFontSize(9);
    doc.text('FROM:', margin, yPos);
    yPos += 5;
    doc.setFont('courier', 'normal');
    doc.setFontSize(9);
    const pickupLines = doc.splitTextToSize(order.pickup_address, maxWidth);
    doc.text(pickupLines, margin, yPos);
    yPos += (pickupLines.length * 5) + 3;

    if (order.pickup_instructions) {
      doc.setFontSize(8);
      doc.text(`Note: ${order.pickup_instructions}`, margin, yPos);
      yPos += 6;
    }

    doc.setFont('courier', 'bold');
    doc.setFontSize(9);
    doc.text('TO:', margin, yPos);
    yPos += 5;
    doc.setFont('courier', 'normal');
    doc.setFontSize(9);
    const deliveryLines = doc.splitTextToSize(order.delivery_address, maxWidth);
    doc.text(deliveryLines, margin, yPos);
    yPos += (deliveryLines.length * 5) + 3;

    if (order.delivery_instructions) {
      doc.setFontSize(8);
      doc.text(`Note: ${order.delivery_instructions}`, margin, yPos);
      yPos += 6;
    }

    doc.setFontSize(9);
    doc.text('Recipient:', margin, yPos);
    doc.setFont('courier', 'bold');
    doc.text(order.recipient_name, pageWidth - margin, yPos, { align: 'right' });
    yPos += 5;

    doc.setFont('courier', 'normal');
    doc.text('Phone:', margin, yPos);
    doc.setFont('courier', 'bold');
    doc.text(order.recipient_phone, pageWidth - margin, yPos, { align: 'right' });
    yPos += 8;

    if (order.scheduled_delivery_time) {
      doc.setFont('courier', 'normal');
      doc.text('Scheduled:', margin, yPos);
      doc.setFont('courier', 'bold');
      doc.text(formatDate(order.scheduled_delivery_time), pageWidth - margin, yPos, { align: 'right' });
      yPos += 8;
    }

    doc.setLineWidth(0.5);
    doc.line(margin, yPos, pageWidth - margin, yPos);
    yPos += 8;

    doc.setFont('courier', 'bold');
    doc.setFontSize(11);
    doc.text('PACKAGE INFO', margin, yPos);
    yPos += 8;

    doc.setFont('courier', 'normal');
    doc.setFontSize(9);
    doc.text('Description:', margin, yPos);
    yPos += 5;
    const descLines = doc.splitTextToSize(order.package_description, maxWidth);
    doc.text(descLines, margin, yPos);
    yPos += (descLines.length * 5) + 5;

    if (order.order_size) {
      doc.text('Size:', margin, yPos);
      doc.setFont('courier', 'bold');
      doc.text(order.order_size.toUpperCase(), pageWidth - margin, yPos, { align: 'right' });
      yPos += 5;
    }

    if (order.order_types && order.order_types.length > 0) {
      doc.setFont('courier', 'normal');
      doc.text('Type:', margin, yPos);
      doc.setFont('courier', 'bold');
      doc.text(order.order_types.join(', ').toUpperCase(), pageWidth - margin, yPos, { align: 'right' });
      yPos += 8;
    }

    doc.setLineWidth(0.5);
    doc.line(margin, yPos, pageWidth - margin, yPos);
    yPos += 10;

    doc.setFont('courier', 'bold');
    doc.setFontSize(14);
    doc.text('DELIVERY FEE:', margin, yPos);
    doc.text(formatCurrency(order.delivery_fee), pageWidth - margin, yPos, { align: 'right' });
    yPos += 10;

    doc.setLineWidth(0.5);
    doc.line(margin, yPos, pageWidth - margin, yPos);
    yPos += 8;

    doc.setFont('courier', 'normal');
    doc.setFontSize(9);
    doc.text('Payment Method:', margin, yPos);
    doc.setFont('courier', 'bold');
    doc.text(order.payment_method.toUpperCase(), pageWidth - margin, yPos, { align: 'right' });
    yPos += 5;

    doc.setFont('courier', 'normal');
    doc.text('Payment Status:', margin, yPos);
    doc.setFont('courier', 'bold');
    doc.text(order.payment_status.toUpperCase(), pageWidth - margin, yPos, { align: 'right' });
    yPos += 10;

    doc.setLineWidth(0.5);
    doc.line(margin, yPos, pageWidth - margin, yPos);
    yPos += 8;

    doc.setFont('courier', 'normal');
    doc.setFontSize(9);
    doc.text('Thank you for using Danhausa Logistics!', pageWidth / 2, yPos, { align: 'center' });
    yPos += 5;
    doc.text('Track your order anytime in the app', pageWidth / 2, yPos, { align: 'center' });
    yPos += 10;

    doc.setLineWidth(0.5);
    doc.line(margin, yPos, pageWidth - margin, yPos);
    yPos += 6;

    doc.setFontSize(8);
    doc.text(`Order ID: ${order.id}`, pageWidth / 2, yPos, { align: 'center' });

    doc.save(`receipt-${order.order_number}.pdf`);
  };

  const generatePrintableReceipt = () => {
    if (!order) return;

    const receiptHTML = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Order Receipt - ${order.order_number}</title>
          <meta charset="UTF-8">
          <style>
            * {
              margin: 0;
              padding: 0;
              box-sizing: border-box;
            }
            body {
              font-family: 'Courier New', Courier, monospace;
              padding: 20px;
              background: white;
              color: #000;
              font-size: 12px;
              line-height: 1.4;
            }
            .receipt {
              max-width: 320px;
              margin: 0 auto;
              padding: 20px;
              border: 1px solid #e5e7eb;
            }
            .center {
              text-align: center;
            }
            .business-name {
              font-size: 18px;
              font-weight: bold;
              margin-bottom: 4px;
            }
            .business-info {
              font-size: 11px;
              color: #666;
              margin-bottom: 2px;
            }
            .divider {
              border-top: 1px dashed #ccc;
              margin: 12px 0;
            }
            .receipt-title {
              font-size: 14px;
              font-weight: bold;
              margin: 12px 0;
            }
            .row {
              display: flex;
              justify-content: space-between;
              margin-bottom: 6px;
            }
            .label {
              color: #666;
            }
            .value {
              font-weight: bold;
              text-align: right;
            }
            .section-title {
              font-size: 12px;
              font-weight: bold;
              margin: 12px 0 8px 0;
            }
            .address-section {
              margin-bottom: 10px;
            }
            .address-label {
              font-size: 10px;
              font-weight: bold;
              color: #666;
              margin-bottom: 4px;
            }
            .address-text {
              font-size: 11px;
              margin-bottom: 4px;
            }
            .instructions {
              font-size: 10px;
              color: #666;
              font-style: italic;
              margin-top: 4px;
            }
            .total-row {
              display: flex;
              justify-content: space-between;
              padding: 8px 0;
              font-size: 14px;
              font-weight: bold;
            }
            .footer-text {
              font-size: 11px;
              color: #666;
              margin-bottom: 4px;
            }
            .footer-small {
              font-size: 9px;
              color: #999;
            }
            @media print {
              body {
                padding: 0;
              }
              .receipt {
                border: none;
              }
            }
          </style>
        </head>
        <body>
          <div class="receipt">
            <div class="center">
              <div class="business-name">DANHAUSA LOGISTICS</div>
              <div class="business-info">info@danhausalogistics.com</div>
              <div class="business-info">danhausalogistics.com</div>
            </div>

            <div class="divider"></div>

            <div class="center receipt-title">ORDER RECEIPT</div>

            <div class="divider"></div>

            <div class="row">
              <span class="label">Order Number:</span>
              <span class="value">${order.order_number}</span>
            </div>

            <div class="row">
              <span class="label">Date:</span>
              <span class="value">${formatDate(order.created_at)}</span>
            </div>

            <div class="row">
              <span class="label">Status:</span>
              <span class="value">${order.status.toUpperCase()}</span>
            </div>

            <div class="divider"></div>

            <div class="section-title">DELIVERY DETAILS</div>

            <div class="address-section">
              <div class="address-label">FROM:</div>
              <div class="address-text">${order.pickup_address}</div>
              ${order.pickup_instructions ? `<div class="instructions">Note: ${order.pickup_instructions}</div>` : ''}
            </div>

            <div class="address-section">
              <div class="address-label">TO:</div>
              <div class="address-text">${order.delivery_address}</div>
              ${order.delivery_instructions ? `<div class="instructions">Note: ${order.delivery_instructions}</div>` : ''}
            </div>

            <div class="row">
              <span class="label">Recipient:</span>
              <span class="value">${order.recipient_name}</span>
            </div>

            <div class="row">
              <span class="label">Phone:</span>
              <span class="value">${order.recipient_phone}</span>
            </div>

            ${order.scheduled_delivery_time ? `
            <div class="row">
              <span class="label">Scheduled:</span>
              <span class="value">${formatDate(order.scheduled_delivery_time)}</span>
            </div>
            ` : ''}

            <div class="divider"></div>

            <div class="section-title">PACKAGE INFO</div>

            <div class="row">
              <span class="label">Description:</span>
            </div>
            <div class="address-text">${order.package_description}</div>

            ${order.order_size ? `
            <div class="row">
              <span class="label">Size:</span>
              <span class="value">${order.order_size.toUpperCase()}</span>
            </div>
            ` : ''}

            ${order.order_types && order.order_types.length > 0 ? `
            <div class="row">
              <span class="label">Type:</span>
              <span class="value">${order.order_types.join(', ').toUpperCase()}</span>
            </div>
            ` : ''}

            <div class="divider"></div>

            <div class="total-row">
              <span>DELIVERY FEE:</span>
              <span>${formatCurrency(order.delivery_fee)}</span>
            </div>

            <div class="divider"></div>

            <div class="row">
              <span class="label">Payment Method:</span>
              <span class="value">${order.payment_method.toUpperCase()}</span>
            </div>

            <div class="row">
              <span class="label">Payment Status:</span>
              <span class="value">${order.payment_status.toUpperCase()}</span>
            </div>

            <div class="divider"></div>

            <div class="center">
              <div class="footer-text">Thank you for using Danhausa Logistics!</div>
              <div class="footer-text">Track your order anytime in the app</div>
            </div>

            <div class="divider"></div>

            <div class="center footer-small">Order ID: ${order.id}</div>
          </div>
          <script>window.onload = function() { window.print(); }</script>
        </body>
      </html>
    `;

    const printWindow = window.open('', '', 'width=400,height=700');
    if (printWindow) {
      printWindow.document.write(receiptHTML);
      printWindow.document.close();
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatCurrency = (amount: number) => {
    return `₦${amount.toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  if (!order && !loading) {
    return null;
  }

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Order Receipt</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <X size={24} color="#6b7280" />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
            {loading ? (
              <View style={styles.loadingContainer}>
                <Text style={styles.loadingText}>Loading receipt...</Text>
              </View>
            ) : order ? (
              <View id="receipt-content" style={styles.receiptContainer}>
                <View style={styles.receipt}>
                  <Text style={styles.businessName}>DANHAUSA LOGISTICS</Text>
                  <Text style={styles.businessInfo}>info@danhausalogistics.com</Text>
                  <Text style={styles.businessInfo}>danhausalogistics.com</Text>

                  <View style={styles.divider} />

                  <Text style={styles.receiptTitle}>ORDER RECEIPT</Text>

                  <View style={styles.divider} />

                  <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>Order Number:</Text>
                    <Text style={styles.infoValue}>{order.order_number}</Text>
                  </View>

                  <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>Date:</Text>
                    <Text style={styles.infoValue}>{formatDate(order.created_at)}</Text>
                  </View>

                  <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>Status:</Text>
                    <Text style={[styles.infoValue, styles.statusText]}>
                      {order.status.toUpperCase()}
                    </Text>
                  </View>

                  <View style={styles.divider} />

                  <Text style={styles.sectionTitle}>DELIVERY DETAILS</Text>

                  <View style={styles.addressSection}>
                    <Text style={styles.addressLabel}>FROM:</Text>
                    <Text style={styles.addressText}>{order.pickup_address}</Text>
                    {order.pickup_instructions && (
                      <Text style={styles.instructionsText}>Note: {order.pickup_instructions}</Text>
                    )}
                  </View>

                  <View style={styles.addressSection}>
                    <Text style={styles.addressLabel}>TO:</Text>
                    <Text style={styles.addressText}>{order.delivery_address}</Text>
                    {order.delivery_instructions && (
                      <Text style={styles.instructionsText}>Note: {order.delivery_instructions}</Text>
                    )}
                  </View>

                  <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>Recipient:</Text>
                    <Text style={styles.infoValue}>{order.recipient_name}</Text>
                  </View>

                  <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>Phone:</Text>
                    <Text style={styles.infoValue}>{order.recipient_phone}</Text>
                  </View>


                  {order.scheduled_delivery_time && (
                    <View style={styles.infoRow}>
                      <Text style={styles.infoLabel}>Scheduled:</Text>
                      <Text style={styles.infoValue}>{formatDate(order.scheduled_delivery_time)}</Text>
                    </View>
                  )}

                  <View style={styles.divider} />

                  <Text style={styles.sectionTitle}>PACKAGE INFO</Text>

                  <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>Description:</Text>
                  </View>
                  <Text style={styles.packageDesc}>{order.package_description}</Text>

                  {order.order_size && (
                    <View style={styles.infoRow}>
                      <Text style={styles.infoLabel}>Size:</Text>
                      <Text style={styles.infoValue}>{order.order_size.toUpperCase()}</Text>
                    </View>
                  )}

                  {order.order_types && order.order_types.length > 0 && (
                    <View style={styles.infoRow}>
                      <Text style={styles.infoLabel}>Type:</Text>
                      <Text style={styles.infoValue}>{order.order_types.join(', ').toUpperCase()}</Text>
                    </View>
                  )}

                  <View style={styles.divider} />

                  <View style={styles.totalRow}>
                    <Text style={styles.totalLabel}>DELIVERY FEE:</Text>
                    <Text style={styles.totalValue}>{formatCurrency(order.delivery_fee)}</Text>
                  </View>

                  <View style={styles.divider} />

                  <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>Payment Method:</Text>
                    <Text style={styles.infoValue}>{order.payment_method.toUpperCase()}</Text>
                  </View>

                  <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>Payment Status:</Text>
                    <Text style={[styles.infoValue, styles.statusText]}>
                      {order.payment_status.toUpperCase()}
                    </Text>
                  </View>

                  <View style={styles.divider} />

                  <Text style={styles.footerText}>Thank you for using Swift Delivery!</Text>
                  <Text style={styles.footerText}>Track your order anytime in the app</Text>

                  <View style={styles.divider} />

                  <Text style={styles.footerSmall}>Order ID: {order.id}</Text>
                </View>
              </View>
            ) : null}
          </ScrollView>

          {Platform.OS === 'web' && (
            <View style={styles.actions}>
              <TouchableOpacity
                style={[styles.actionButton, styles.printButton]}
                onPress={handlePrint}
                disabled={loading}
              >
                <Printer size={20} color="#ffffff" />
                <Text style={styles.actionButtonText}>Print</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.actionButton, styles.downloadButton]}
                onPress={handleDownload}
                disabled={loading}
              >
                <Download size={20} color="#ffffff" />
                <Text style={styles.actionButtonText}>Download</Text>
              </TouchableOpacity>
            </View>
          )}

          {Platform.OS !== 'web' && !loading && (
            <View style={styles.mobileFooter}>
              <Text style={styles.mobileFooterText}>
                Screenshot this receipt for your records
              </Text>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: Platform.OS === 'web' ? 'center' : 'flex-end',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#ffffff',
    borderRadius: Platform.OS === 'web' ? 16 : 24,
    width: Platform.OS === 'web' ? '90%' : '100%',
    maxWidth: Platform.OS === 'web' ? 500 : undefined,
    height: Platform.OS === 'web' ? undefined : '100%',
    maxHeight: Platform.OS === 'web' ? '90%' : '100%',
    overflow: 'hidden',
    marginTop: Platform.OS === 'web' ? 0 : 40,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    fontFamily: Fonts.bold,
    color: '#111827',
  },
  closeButton: {
    padding: 4,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: Platform.OS === 'web' ? 20 : 16,
    paddingBottom: Platform.OS === 'web' ? 20 : 40,
  },
  loadingContainer: {
    padding: 40,
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    fontFamily: Fonts.regular,
    color: '#6b7280',
  },
  receiptContainer: {
    backgroundColor: '#ffffff',
    alignItems: 'center',
  },
  receipt: {
    width: '100%',
    maxWidth: Platform.OS === 'web' ? 320 : undefined,
    backgroundColor: '#ffffff',
    padding: Platform.OS === 'web' ? 20 : 16,
    borderWidth: Platform.OS === 'web' ? 1 : 0,
    borderColor: '#e5e7eb',
    borderRadius: Platform.OS === 'web' ? 8 : 0,
  },
  businessName: {
    fontSize: 20,
    fontWeight: '700',
    fontFamily: Fonts.bold,
    textAlign: 'center',
    color: '#111827',
    marginBottom: 4,
  },
  businessInfo: {
    fontSize: 12,
    fontFamily: Fonts.regular,
    textAlign: 'center',
    color: '#6b7280',
    marginBottom: 2,
  },
  divider: {
    height: 1,
    backgroundColor: '#e5e7eb',
    marginVertical: 12,
  },
  receiptTitle: {
    fontSize: 16,
    fontWeight: '700',
    fontFamily: Fonts.bold,
    textAlign: 'center',
    color: '#111827',
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    fontFamily: Fonts.bold,
    color: '#111827',
    marginBottom: 8,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  infoLabel: {
    fontSize: 12,
    fontFamily: Fonts.medium,
    color: '#6b7280',
  },
  infoValue: {
    fontSize: 12,
    fontFamily: Fonts.semiBold,
    color: '#111827',
    textAlign: 'right',
    flex: 1,
    marginLeft: 8,
  },
  statusText: {
    color: '#f97316',
  },
  addressSection: {
    marginBottom: 12,
  },
  addressLabel: {
    fontSize: 11,
    fontWeight: '700',
    fontFamily: Fonts.bold,
    color: '#6b7280',
    marginBottom: 4,
  },
  addressText: {
    fontSize: 12,
    fontFamily: Fonts.regular,
    color: '#111827',
    lineHeight: 16,
  },
  instructionsText: {
    fontSize: 11,
    fontFamily: Fonts.regular,
    color: '#6b7280',
    fontStyle: 'italic',
    marginTop: 4,
  },
  packageDesc: {
    fontSize: 12,
    fontFamily: Fonts.regular,
    color: '#111827',
    marginBottom: 8,
    lineHeight: 16,
  },
  priceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  priceLabel: {
    fontSize: 13,
    fontFamily: Fonts.medium,
    color: '#111827',
  },
  priceValue: {
    fontSize: 13,
    fontFamily: Fonts.semiBold,
    color: '#111827',
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  totalLabel: {
    fontSize: 16,
    fontWeight: '700',
    fontFamily: Fonts.bold,
    color: '#111827',
  },
  totalValue: {
    fontSize: 18,
    fontWeight: '700',
    fontFamily: Fonts.bold,
    color: '#f97316',
  },
  footerText: {
    fontSize: 12,
    fontFamily: Fonts.medium,
    textAlign: 'center',
    color: '#6b7280',
    marginBottom: 4,
  },
  footerSmall: {
    fontSize: 10,
    fontFamily: Fonts.regular,
    textAlign: 'center',
    color: '#9ca3af',
  },
  actions: {
    flexDirection: 'row',
    padding: 20,
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 14,
    borderRadius: 12,
  },
  printButton: {
    backgroundColor: '#6366f1',
  },
  downloadButton: {
    backgroundColor: '#f97316',
  },
  actionButtonText: {
    fontSize: 15,
    fontWeight: '600',
    fontFamily: Fonts.semiBold,
    color: '#ffffff',
  },
  mobileFooter: {
    padding: 20,
    backgroundColor: '#f9fafb',
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    alignItems: 'center',
  },
  mobileFooterText: {
    fontSize: 14,
    fontFamily: Fonts.medium,
    color: '#6b7280',
    textAlign: 'center',
  },
});
