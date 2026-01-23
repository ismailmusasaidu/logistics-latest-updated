# Paystack Payment Setup Guide

This guide explains how to configure Paystack payments for your delivery app.

## Overview

The app uses Paystack for secure payment processing in two ways:
1. **Order Payments**: Customers can pay for delivery orders online
2. **Wallet Funding**: Customers can add money to their wallet balance

All sensitive operations are handled server-side through Supabase Edge Functions to ensure your API keys remain secure.

## Prerequisites

- A Paystack account (sign up at https://paystack.com)
- Access to your Supabase project dashboard
- Your app deployed or running locally

## Step 1: Get Your Paystack API Keys

1. Log in to your Paystack Dashboard: https://dashboard.paystack.co
2. Navigate to **Settings** → **API Keys & Webhooks**
3. You'll see two sets of keys:
   - **Test Keys**: For development and testing (starts with `sk_test_`)
   - **Live Keys**: For production use (starts with `sk_live_`)
4. Copy your **Secret Key**

## Step 2: Configure Paystack in Supabase

The Paystack secret key must be stored securely in Supabase Edge Functions secrets.

### Using Supabase Dashboard:

1. Go to your Supabase project dashboard
2. Navigate to **Edge Functions** → **Manage secrets**
3. Add a new secret:
   - **Name**: `PAYSTACK_SECRET_KEY`
   - **Value**: Your Paystack secret key (e.g., `sk_test_xxxxxxxxxxxxx`)
4. Click **Save**

### Security Best Practices:

- ✅ **NEVER** commit your Paystack secret key to version control
- ✅ **NEVER** expose your secret key in client-side code
- ✅ The secret key is only accessible in Edge Functions (server-side)
- ✅ Use test keys during development
- ✅ Switch to live keys only when ready for production

## Step 3: Test the Payment Flow

### Development Testing:

Use Paystack test cards for testing:

| Card Type | Card Number | CVV | Expiry | Result |
|-----------|-------------|-----|--------|--------|
| Success | 4084 0840 8408 4081 | Any 3 digits | Any future date | Payment succeeds |
| Insufficient Funds | 5060 6666 6666 6666 | Any 3 digits | Any future date | Declined |
| Declined | 5090 8888 8888 8888 | Any 3 digits | Any future date | Declined |

### Testing Steps:

1. Create an order in your app
2. Select "Online Payment" as the payment method
3. Click "Pay Now"
4. You'll be redirected to Paystack's payment page
5. Enter a test card number
6. Complete the payment
7. You'll be redirected back to the app
8. Verify the order payment status is updated

### Production Setup:

1. Complete Paystack's business verification process
2. Update your business information in Paystack Dashboard
3. Replace test keys with live keys in Supabase Edge Functions secrets
4. Test with small real transactions first
5. Monitor transactions in your Paystack Dashboard

## Payment Types

### 1. Order Payments
Used when customers select "Online Payment" during checkout. The payment is linked to a specific order.

### 2. Wallet Funding
Customers can add money to their wallet balance, which can then be used for:
- Quick order payments (no need to enter payment details each time)
- Multiple orders using the same balance
- Faster checkout experience

## Architecture

The payment system uses four Supabase Edge Functions for security:

### Order Payment Functions

#### 1. initialize-payment
- **Purpose**: Securely initializes payment transactions with Paystack
- **Security**: Requires JWT authentication (user must be logged in)
- **Endpoint**: `/functions/v1/initialize-payment`
- **Method**: POST
- **Request Body**:
  ```json
  {
    "email": "customer@example.com",
    "amount": 5000,
    "orderId": "order_123",
    "metadata": {
      "userId": "user_123",
      "deliveryFee": 5000
    }
  }
  ```
- **Response**:
  ```json
  {
    "success": true,
    "authorizationUrl": "https://checkout.paystack.com/...",
    "accessCode": "...",
    "reference": "order_123"
  }
  ```

#### 2. verify-payment
- **Purpose**: Verifies payment completion with Paystack
- **Security**: Public endpoint (used for callbacks)
- **Endpoint**: `/functions/v1/verify-payment?reference=xxx`
- **Method**: GET
- **Response**:
  ```json
  {
    "success": true,
    "message": "Payment verified successfully",
    "orderId": "order_123",
    "amount": 5000,
    "paymentData": {
      "reference": "order_123",
      "status": "success",
      "paidAt": "2024-01-01T00:00:00Z"
    }
  }
  ```

### Wallet Funding Functions

#### 3. initialize-wallet-funding
- **Purpose**: Securely initializes wallet funding transactions with Paystack
- **Security**: Requires JWT authentication (user must be logged in)
- **Endpoint**: `/functions/v1/initialize-wallet-funding`
- **Method**: POST
- **Request Body**:
  ```json
  {
    "amount": 1000
  }
  ```
- **Response**:
  ```json
  {
    "success": true,
    "authorizationUrl": "https://checkout.paystack.com/...",
    "reference": "wallet_user123_1234567890",
    "amount": 1000
  }
  ```
- **Validation**:
  - Minimum amount: ₦100
  - Maximum amount: ₦1,000,000
  - User authentication required

#### 4. verify-wallet-funding
- **Purpose**: Verifies wallet funding completion and credits user's wallet
- **Security**: Uses service role (server-side verification only)
- **Endpoint**: `/functions/v1/verify-wallet-funding`
- **Method**: POST
- **Request Body**:
  ```json
  {
    "reference": "wallet_user123_1234567890"
  }
  ```
- **Response**:
  ```json
  {
    "success": true,
    "verified": true,
    "message": "Wallet funded successfully",
    "amount": 1000,
    "reference": "wallet_user123_1234567890",
    "paidAt": "2024-01-01T00:00:00Z"
  }
  ```
- **Security Features**:
  - Amount verification (must match expected amount)
  - Idempotent (safe to call multiple times)
  - Automatic wallet balance update
  - Transaction history logging

## Payment Flow Diagrams

### Order Payment Flow

```
Customer → Select Online Payment
         ↓
    Checkout Modal (Frontend)
         ↓
    initialize-payment Edge Function
         ↓
    Paystack API (Initialize)
         ↓
    Redirect to Paystack Payment Page
         ↓
    Customer Completes Payment
         ↓
    Paystack Redirects Back
         ↓
    verify-payment Edge Function
         ↓
    Paystack API (Verify)
         ↓
    Update Order Status in Database
         ↓
    Show Success Message to Customer
```

### Wallet Funding Flow

```
Customer → Opens Wallet Funding Modal
         ↓
    Enters Amount (min ₦100, max ₦1,000,000)
         ↓
    initialize-wallet-funding Edge Function
         ↓
    Paystack API (Initialize)
         ↓
    Redirect to Paystack Payment Page
         ↓
    Customer Completes Payment
         ↓
    Automatic Verification Polling (every 3 seconds)
         ↓
    verify-wallet-funding Edge Function
         ↓
    Paystack API (Verify)
         ↓
    Credit User Wallet via Database Function
         ↓
    Record Transaction in wallet_transactions
         ↓
    Show Success Message & Updated Balance
```

## Features

### Wallet System Features
- **Quick Amounts**: Predefined amounts (₦500, ₦1000, ₦2000, ₦5000, ₦10000) for faster funding
- **Auto Verification**: Automatically checks payment status after redirect
- **Manual Verification**: Option to manually verify if automatic check fails
- **Transaction History**: All wallet activity is logged and visible
- **Real-time Balance**: Wallet balance updates immediately after successful payment
- **Secure**: All operations happen server-side with proper validation

### Security Features
- JWT authentication required for wallet funding
- Amount validation (min/max limits)
- Server-side payment verification
- Amount mismatch detection
- Duplicate payment prevention
- Comprehensive audit trail

## Troubleshooting

### Payment initialization fails:

**Error**: "Paystack secret key not configured"
- **Solution**: Ensure `PAYSTACK_SECRET_KEY` is set in Supabase Edge Functions secrets
- Verify you're using the correct key format (starts with `sk_test_` or `sk_live_`)

**Error**: "Failed to initialize payment"
- Check Supabase Edge Function logs for detailed error messages
- Verify your Paystack account is active
- Ensure the email address is valid

### Payment verification fails:

**Error**: "Payment verification failed"
- Check that the payment reference is correct
- Verify the order exists in the database
- Check Supabase Edge Function logs

**Error**: "Failed to update order status"
- Verify database permissions (RLS policies)
- Check that the order ID matches

### Paystack page doesn't open:

- Ensure the app has permission to open external URLs
- Check network connectivity
- Verify the authorization URL is valid
- On mobile, check that `Linking` module is properly configured

### Payment stuck in pending:

- Manually verify the transaction in Paystack Dashboard
- Check if the webhook callback was received
- Manually trigger payment verification by calling the verify-payment endpoint

### Wallet not credited after payment:

**Symptom**: Payment successful in Paystack but wallet balance not updated

**Solution**:
1. Check wallet_recharges table for the transaction record
2. Verify the payment reference matches
3. Manually call verify-wallet-funding with the reference
4. Check edge function logs for errors
5. Verify database function permissions

**Prevention**:
- Automatic verification polling runs for 5 minutes
- Manual verification button available in the app
- All transactions logged for audit

### Amount validation errors:

**Error**: "Minimum funding amount is ₦100"
- Solution: Enter amount of ₦100 or more

**Error**: "Maximum funding amount is ₦1,000,000"
- Solution: Enter amount less than or equal to ₦1,000,000
- For larger amounts, contact support for manual processing

## Monitoring

### Paystack Dashboard:

1. Monitor all transactions in **Transactions** section
2. View payment analytics in **Dashboard**
3. Set up email notifications for payments
4. Export transaction reports

### Supabase Logs:

1. Navigate to **Edge Functions** → **Logs**
2. Filter by function name:
   - `initialize-payment` - Order payment initialization
   - `verify-payment` - Order payment verification
   - `initialize-wallet-funding` - Wallet funding initialization
   - `verify-wallet-funding` - Wallet funding verification
3. Check for error messages or failed requests

### Database Monitoring:

Monitor wallet transactions:
```sql
-- View all pending wallet recharges
SELECT * FROM wallet_recharges
WHERE status = 'pending'
ORDER BY created_at DESC;

-- View completed recharges today
SELECT COUNT(*), SUM(amount)
FROM wallet_recharges
WHERE status = 'completed'
AND completed_at >= CURRENT_DATE;

-- View failed recharges
SELECT * FROM wallet_recharges
WHERE status = 'failed'
ORDER BY failed_at DESC;

-- View user's wallet transactions
SELECT * FROM wallet_transactions
WHERE user_id = 'user-uuid'
ORDER BY created_at DESC;
```

## Advanced Configuration

### Webhook Setup (Optional):

For real-time payment notifications without polling:

1. In Paystack Dashboard, go to **Settings** → **Webhooks**
2. Add webhook URL: `https://your-supabase-url.supabase.co/functions/v1/verify-payment`
3. Select events: `charge.success`
4. Save and test the webhook

### Custom Callback URL:

To customize where users are redirected after payment, update the `callback_url` in the initialize-payment edge function.

## Support Resources

- **Paystack Documentation**: https://paystack.com/docs
- **Paystack Support**: support@paystack.com
- **Test Cards**: https://paystack.com/docs/payments/test-payments
- **API Reference**: https://paystack.com/docs/api
- **Status Page**: https://status.paystack.com

## Security Checklist

Before going live, ensure:

### API Keys
- [ ] Using live keys (not test keys) in production
- [ ] Secret keys are stored in Supabase Edge Functions secrets
- [ ] No API keys in client-side code or version control

### Infrastructure
- [ ] HTTPS enabled for all endpoints
- [ ] Edge functions deployed and tested
- [ ] Database functions created and tested
- [ ] RLS policies enabled on all tables

### Payment Processing
- [ ] Payment verification happens server-side
- [ ] Amount validation is enforced
- [ ] Duplicate payment prevention works
- [ ] Failed payment handling is correct

### Monitoring
- [ ] Transaction monitoring is set up
- [ ] Error logging is configured
- [ ] Database audit trail is working
- [ ] Alert system configured

### User Experience
- [ ] User authentication is enforced
- [ ] Wallet funding limits are appropriate
- [ ] Error messages are user-friendly
- [ ] Success confirmations are clear

### Testing
- [ ] All payment scenarios tested with test cards
- [ ] Wallet funding tested end-to-end
- [ ] Edge cases handled (duplicates, failures, timeouts)
- [ ] Rate limiting tested

## Currency Support

By default, the integration uses Nigerian Naira (NGN) and amounts are converted to kobo (smallest unit).

To support other currencies:
1. Update the amount conversion in initialize-payment edge function
2. Verify currency is supported by Paystack
3. Update the currency display in the frontend

## FAQ

### General

**Q: Can I test without a Paystack account?**
A: No, you need a Paystack account to get API keys.

**Q: Are test payments free?**
A: Yes, test mode transactions don't incur any charges.

**Q: How long does verification take?**
A: Verification is instant (typically < 2 seconds).

**Q: Can customers use mobile money?**
A: Yes, if your Paystack account supports it. The payment page will show available options.

### Wallet System

**Q: What's the difference between wallet payment and online payment?**
A:
- **Wallet Payment**: Uses pre-funded balance, instant checkout, no redirect to payment page
- **Online Payment**: Direct payment for order, requires Paystack checkout, processed per order

**Q: Why use wallet funding?**
A:
- Faster checkout (no need to enter card details each time)
- Can use balance for multiple orders
- Pre-fund during offers/promotions
- Better transaction tracking

**Q: Are there fees for wallet funding?**
A: Paystack charges standard transaction fees. Check your Paystack dashboard for current rates.

**Q: What are the wallet funding limits?**
A:
- Minimum: ₦100 per transaction
- Maximum: ₦1,000,000 per transaction
- No daily limit (but Paystack may have account limits)

**Q: How long does wallet funding take?**
A: Immediate! Once payment is confirmed, your wallet is credited within seconds.

**Q: Can I get a refund to my wallet?**
A: Yes, when orders are cancelled, refunds are automatically credited to your wallet.

**Q: Is my wallet balance safe?**
A: Yes, wallet balances are:
- Stored in secure database
- Protected by RLS policies
- Audited with transaction logs
- Cannot be modified by users directly

### Troubleshooting

**Q: What happens if payment fails?**
A:
- Order payments: Order remains pending, try again or choose different method
- Wallet funding: No money deducted, transaction marked as failed, can retry

**Q: I paid but my wallet wasn't credited, what do I do?**
A:
1. Wait 2-3 minutes for auto-verification
2. Use "Already paid? Verify now" button in the app
3. Contact support with payment reference
4. Check Paystack dashboard to confirm payment status

**Q: How do I refund a payment?**
A: Refunds are processed through the Paystack Dashboard under the specific transaction.

**Q: Can I withdraw money from my wallet?**
A: Currently, wallet balance can only be used for orders. Contact support for special cases.
