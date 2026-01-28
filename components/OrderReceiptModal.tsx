import { View, Text, StyleSheet, Modal, TouchableOpacity, ScrollView, Platform, Share } from 'react-native';
import { X, Download, Printer, Share2 } from 'lucide-react-native';
import { Fonts } from '@/constants/fonts';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import * as Print from 'expo-print';

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

  const createHTMLReceipt = () => {
    if (!order) return '';

    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <style>
            * {
              margin: 0;
              padding: 0;
              box-sizing: border-box;
            }
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
              padding: 24px;
              font-size: 11px;
              line-height: 1.4;
            }
            .header {
              text-align: center;
              margin-bottom: 16px;
              border-bottom: 1px solid #e5e7eb;
              padding-bottom: 12px;
            }
            .company-name {
              font-size: 18px;
              font-weight: 700;
              margin-bottom: 4px;
              letter-spacing: 0.5px;
            }
            .company-info {
              font-size: 10px;
              color: #6b7280;
            }
            .title {
              text-align: center;
              font-size: 14px;
              font-weight: 700;
              margin: 12px 0;
              border-top: 1px solid #e5e7eb;
              border-bottom: 1px solid #e5e7eb;
              padding: 8px 0;
              letter-spacing: 1px;
            }
            .section {
              margin: 12px 0;
              padding: 8px 0;
              border-bottom: 1px solid #e5e7eb;
            }
            .section-title {
              font-weight: 700;
              font-size: 11px;
              margin-bottom: 6px;
              letter-spacing: 0.3px;
            }
            .field {
              margin: 4px 0;
            }
            .label {
              font-weight: normal;
              color: #6b7280;
              font-size: 10px;
            }
            .value {
              font-weight: 600;
              margin-left: 5px;
              font-size: 10px;
            }
            .subsection {
              margin: 8px 0;
            }
            .subsection-title {
              font-weight: 700;
              margin-bottom: 3px;
              font-size: 10px;
              color: #6b7280;
              letter-spacing: 0.3px;
            }
            .fee-section {
              margin: 12px 0;
              padding: 12px;
              background: #fef3f2;
              border: 1px solid #f97316;
              border-radius: 8px;
            }
            .fee-label {
              font-size: 12px;
              font-weight: 700;
              letter-spacing: 0.5px;
            }
            .fee-amount {
              font-size: 18px;
              font-weight: 700;
              margin-top: 6px;
              color: #f97316;
            }
            .footer {
              text-align: center;
              margin-top: 16px;
              padding-top: 12px;
              border-top: 1px solid #e5e7eb;
              font-size: 9px;
              color: #6b7280;
            }
            .order-id {
              margin-top: 8px;
              font-size: 8px;
              color: #9ca3af;
            }
          </style>
        </head>
        <body>
          <div class="header">
            <div class="company-name">DANHAUSA LOGISTICS</div>
            <div class="company-info">info@danhausalogistics.com</div>
            <div class="company-info">danhausalogistics.com</div>
          </div>

          <div class="title">ORDER RECEIPT</div>

          <div class="section">
            <div class="field">
              <span class="label">Order Number:</span>
              <span class="value">${order.order_number}</span>
            </div>
            <div class="field">
              <span class="label">Date:</span>
              <span class="value">${formatDate(order.created_at)}</span>
            </div>
            <div class="field">
              <span class="label">Status:</span>
              <span class="value">${order.status.toUpperCase()}</span>
            </div>
          </div>

          <div class="section">
            <div class="section-title">DELIVERY DETAILS</div>

            <div class="subsection">
              <div class="subsection-title">FROM:</div>
              <div>${order.pickup_address}</div>
              ${order.pickup_instructions ? `<div style="margin-top: 5px; font-size: 12px; color: #666;">Note: ${order.pickup_instructions}</div>` : ''}
            </div>

            <div class="subsection">
              <div class="subsection-title">TO:</div>
              <div>${order.delivery_address}</div>
              ${order.delivery_instructions ? `<div style="margin-top: 5px; font-size: 12px; color: #666;">Note: ${order.delivery_instructions}</div>` : ''}
            </div>

            <div class="field">
              <span class="label">Recipient:</span>
              <span class="value">${order.recipient_name}</span>
            </div>
            <div class="field">
              <span class="label">Phone:</span>
              <span class="value">${order.recipient_phone}</span>
            </div>
            ${order.scheduled_delivery_time ? `
            <div class="field">
              <span class="label">Scheduled:</span>
              <span class="value">${formatDate(order.scheduled_delivery_time)}</span>
            </div>
            ` : ''}
          </div>

          <div class="section">
            <div class="section-title">PACKAGE INFO</div>
            <div class="field">
              <span class="label">Description:</span>
              <span class="value">${order.package_description}</span>
            </div>
            ${order.order_size ? `
            <div class="field">
              <span class="label">Size:</span>
              <span class="value">${order.order_size.toUpperCase()}</span>
            </div>
            ` : ''}
            ${order.order_types && order.order_types.length > 0 ? `
            <div class="field">
              <span class="label">Type:</span>
              <span class="value">${order.order_types.join(', ').toUpperCase()}</span>
            </div>
            ` : ''}
          </div>

          <div class="fee-section">
            <div class="fee-label">DELIVERY FEE</div>
            <div class="fee-amount">${formatCurrency(order.delivery_fee)}</div>
          </div>

          <div class="section">
            <div class="field">
              <span class="label">Payment Method:</span>
              <span class="value">${order.payment_method.toUpperCase()}</span>
            </div>
            <div class="field">
              <span class="label">Payment Status:</span>
              <span class="value">${order.payment_status.toUpperCase()}</span>
            </div>
          </div>

          <div class="footer">
            <div>Thank you for using Danhausa Logistics!</div>
            <div>Track your order anytime in the app</div>
            <div class="order-id">Order ID: ${order.id}</div>
          </div>
        </body>
      </html>
    `;
  };

  const handleShare = async () => {
    if (!order) return;

    try {
      if (Platform.OS === 'web') {
        const receiptText = `
DANHAUSA LOGISTICS
Receipt

Order Number: ${order.order_number}
Date: ${formatDate(order.created_at)}
Status: ${order.status.toUpperCase()}

═══════════════════════════

DELIVERY DETAILS

FROM:
${order.pickup_address}
${order.pickup_instructions ? `Note: ${order.pickup_instructions}` : ''}

TO:
${order.delivery_address}
${order.delivery_instructions ? `Note: ${order.delivery_instructions}` : ''}

Recipient: ${order.recipient_name}
Phone: ${order.recipient_phone}
${order.scheduled_delivery_time ? `Scheduled: ${formatDate(order.scheduled_delivery_time)}` : ''}

═══════════════════════════

PACKAGE INFO

Description: ${order.package_description}
${order.order_size ? `Size: ${order.order_size.toUpperCase()}` : ''}
${order.order_types && order.order_types.length > 0 ? `Type: ${order.order_types.join(', ').toUpperCase()}` : ''}

═══════════════════════════

DELIVERY FEE: ${formatCurrency(order.delivery_fee)}

Payment Method: ${order.payment_method.toUpperCase()}
Payment Status: ${order.payment_status.toUpperCase()}

═══════════════════════════

Thank you for using Danhausa Logistics!
Track your order anytime in the app

Order ID: ${order.id}
        `.trim();

        await Share.share({
          message: receiptText,
          title: `Receipt - ${order.order_number}`,
        });
      } else {
        const html = createHTMLReceipt();
        const { uri } = await Print.printToFileAsync({ html });

        if (await Sharing.isAvailableAsync()) {
          await Sharing.shareAsync(uri, {
            mimeType: 'application/pdf',
            dialogTitle: `Receipt - ${order.order_number}`,
            UTI: 'com.adobe.pdf',
          });
        }
      }
    } catch (error) {
      console.error('Error sharing receipt:', error);
    }
  };

  const generatePDF = () => {
    if (!order || Platform.OS !== 'web') return;

    generatePrintableReceipt();
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
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
              padding: 16px;
              background: white;
              color: #000;
              font-size: 11px;
              line-height: 1.4;
            }
            .receipt {
              max-width: 360px;
              margin: 0 auto;
              padding: 20px;
              border: 1px solid #e5e7eb;
            }
            .center {
              text-align: center;
            }
            .business-name {
              font-size: 16px;
              font-weight: 700;
              margin-bottom: 2px;
              letter-spacing: 0.5px;
            }
            .business-info {
              font-size: 10px;
              color: #6b7280;
              margin-bottom: 1px;
            }
            .divider {
              border-top: 1px solid #e5e7eb;
              margin: 8px 0;
            }
            .receipt-title {
              font-size: 13px;
              font-weight: 700;
              margin: 8px 0;
              letter-spacing: 1px;
            }
            .row {
              display: flex;
              justify-content: space-between;
              margin-bottom: 4px;
              align-items: flex-start;
            }
            .label {
              color: #6b7280;
              font-size: 10px;
            }
            .value {
              font-weight: 600;
              text-align: right;
              font-size: 10px;
            }
            .section-title {
              font-size: 10px;
              font-weight: 700;
              margin: 8px 0 6px 0;
              letter-spacing: 0.3px;
            }
            .address-section {
              margin-bottom: 8px;
            }
            .address-label {
              font-size: 9px;
              font-weight: 700;
              color: #6b7280;
              margin-bottom: 3px;
              letter-spacing: 0.3px;
            }
            .address-text {
              font-size: 10px;
              margin-bottom: 3px;
            }
            .instructions {
              font-size: 9px;
              color: #6b7280;
              font-style: italic;
              margin-top: 3px;
            }
            .total-row {
              display: flex;
              justify-content: space-between;
              padding: 6px 0;
              font-size: 12px;
              font-weight: 700;
              letter-spacing: 0.5px;
            }
            .total-value {
              font-size: 15px;
              color: #f97316;
            }
            .footer-text {
              font-size: 9px;
              color: #6b7280;
              margin-bottom: 3px;
            }
            .footer-small {
              font-size: 8px;
              color: #9ca3af;
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
              <span class="total-value">${formatCurrency(order.delivery_fee)}</span>
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

                  <Text style={styles.footerText}>Thank you for using Danhausa Logistics!</Text>
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
                <Text style={styles.actionButtonText}>Save as PDF</Text>
              </TouchableOpacity>
            </View>
          )}

          {Platform.OS !== 'web' && !loading && (
            <View style={styles.actions}>
              <TouchableOpacity
                style={[styles.actionButton, styles.shareButton]}
                onPress={handleShare}
                disabled={loading}
              >
                <Share2 size={20} color="#ffffff" />
                <Text style={styles.actionButtonText}>Share Receipt</Text>
              </TouchableOpacity>
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
    maxWidth: Platform.OS === 'web' ? 360 : undefined,
    backgroundColor: '#ffffff',
    padding: Platform.OS === 'web' ? 24 : 20,
    borderWidth: Platform.OS === 'web' ? 1 : 0,
    borderColor: '#e5e7eb',
    borderRadius: Platform.OS === 'web' ? 12 : 0,
  },
  businessName: {
    fontSize: 18,
    fontWeight: '700',
    fontFamily: Fonts.poppinsBold,
    textAlign: 'center',
    color: '#111827',
    marginBottom: 2,
    letterSpacing: 0.5,
  },
  businessInfo: {
    fontSize: 11,
    fontFamily: Fonts.poppinsRegular,
    textAlign: 'center',
    color: '#6b7280',
    marginBottom: 1,
  },
  divider: {
    height: 1,
    backgroundColor: '#e5e7eb',
    marginVertical: 8,
  },
  receiptTitle: {
    fontSize: 14,
    fontWeight: '700',
    fontFamily: Fonts.poppinsBold,
    textAlign: 'center',
    color: '#111827',
    letterSpacing: 1,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '700',
    fontFamily: Fonts.poppinsBold,
    color: '#111827',
    marginBottom: 6,
    letterSpacing: 0.3,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
    alignItems: 'flex-start',
  },
  infoLabel: {
    fontSize: 11,
    fontFamily: Fonts.poppinsRegular,
    color: '#6b7280',
  },
  infoValue: {
    fontSize: 11,
    fontFamily: Fonts.poppinsSemiBold,
    color: '#111827',
    textAlign: 'right',
    flex: 1,
    marginLeft: 8,
  },
  statusText: {
    color: '#f97316',
  },
  addressSection: {
    marginBottom: 8,
  },
  addressLabel: {
    fontSize: 10,
    fontWeight: '700',
    fontFamily: Fonts.poppinsBold,
    color: '#6b7280',
    marginBottom: 3,
    letterSpacing: 0.3,
  },
  addressText: {
    fontSize: 11,
    fontFamily: Fonts.poppinsRegular,
    color: '#111827',
    lineHeight: 16,
  },
  instructionsText: {
    fontSize: 10,
    fontFamily: Fonts.poppinsRegular,
    color: '#6b7280',
    fontStyle: 'italic',
    marginTop: 3,
  },
  packageDesc: {
    fontSize: 11,
    fontFamily: Fonts.poppinsRegular,
    color: '#111827',
    marginBottom: 6,
    lineHeight: 16,
  },
  priceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  priceLabel: {
    fontSize: 11,
    fontFamily: Fonts.poppinsRegular,
    color: '#111827',
  },
  priceValue: {
    fontSize: 11,
    fontFamily: Fonts.poppinsSemiBold,
    color: '#111827',
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
  },
  totalLabel: {
    fontSize: 13,
    fontWeight: '700',
    fontFamily: Fonts.poppinsBold,
    color: '#111827',
    letterSpacing: 0.5,
  },
  totalValue: {
    fontSize: 16,
    fontWeight: '700',
    fontFamily: Fonts.poppinsBold,
    color: '#f97316',
  },
  footerText: {
    fontSize: 10,
    fontFamily: Fonts.poppinsRegular,
    textAlign: 'center',
    color: '#6b7280',
    marginBottom: 3,
  },
  footerSmall: {
    fontSize: 9,
    fontFamily: Fonts.poppinsRegular,
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
  shareButton: {
    backgroundColor: '#10b981',
  },
  actionButtonText: {
    fontSize: 15,
    fontWeight: '600',
    fontFamily: Fonts.semiBold,
    color: '#ffffff',
  },
});
