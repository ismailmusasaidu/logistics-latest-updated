# Virtual Accounts Guide

This guide explains how the dedicated virtual account system works for wallet funding.

## Overview

Each customer gets a **permanent virtual bank account** (powered by Paystack) that they can use to fund their wallet. When they transfer money to this account, their wallet is automatically credited within seconds.

## Benefits

- **No fees** - Unlike card payments, bank transfers don't incur Paystack gateway fees
- **Convenience** - Customers can save the account number and reuse it anytime
- **Instant crediting** - Wallet is updated automatically via webhook
- **Familiar process** - Customers use their regular banking app

## How It Works

### 1. Account Creation

When a customer first opens the wallet funding modal:
- The system checks if they already have a virtual account
- If not, it calls Paystack's API to create a dedicated account
- The account is linked to the customer's profile
- Account details are stored in the `virtual_accounts` table

### 2. Making Transfers

Customers can:
- View their account number, bank name, and account name in the app
- Copy account details with one tap
- Transfer any amount from their bank app
- No minimum or maximum transfer limits (bank-dependent)

### 3. Auto-Crediting

When a transfer is received:
- Paystack sends a webhook to `/functions/v1/paystack-webhook`
- The webhook verifies the signature for security
- The system identifies the customer by their account
- The wallet balance is updated automatically
- A transaction record is created in `wallet_recharges`

## Database Schema

### virtual_accounts Table

```sql
- id: uuid (primary key)
- user_id: uuid (references profiles)
- account_number: text (unique)
- account_name: text
- bank_name: text (e.g., "Wema Bank")
- bank_code: text
- provider: text (default: "paystack")
- provider_reference: text (customer_code)
- is_active: boolean
- created_at: timestamptz
- updated_at: timestamptz
```

## Edge Functions

### 1. create-virtual-account

**URL**: `/functions/v1/create-virtual-account`

**Purpose**: Creates a dedicated virtual account for a user

**Process**:
1. Check if user already has an account
2. Get user profile details
3. Create/fetch customer on Paystack
4. Request dedicated virtual account from Paystack
5. Save account details to database
6. Return account information

**Authentication**: Required (JWT)

### 2. paystack-webhook

**URL**: `/functions/v1/paystack-webhook`

**Purpose**: Processes incoming transfer notifications

**Events Handled**:
- `charge.success` - When a transfer is completed
- `dedicatedaccount.assign.success` - When account is created

**Process**:
1. Verify webhook signature
2. Extract payment details
3. Find customer by virtual account
4. Check for duplicate transactions
5. Update wallet balance
6. Record transaction in `wallet_recharges`

**Authentication**: None (uses signature verification)

## Webhook Configuration

### Setting Up on Paystack

1. Log in to [Paystack Dashboard](https://dashboard.paystack.co)
2. Go to **Settings** > **Webhooks**
3. Add webhook URL: `https://YOUR_PROJECT.supabase.co/functions/v1/paystack-webhook`
4. Select events to listen for:
   - `charge.success`
   - `dedicatedaccount.assign.success`
5. Save configuration

### Security

The webhook endpoint:
- Verifies Paystack signature on every request
- Rejects requests with invalid signatures
- Prevents duplicate transaction processing
- Uses service role key for database operations

## User Interface

### Wallet Funding Modal

The modal has two tabs:

**1. Bank Transfer (Default)**
- Shows dedicated account details
- One-tap copy for account number and name
- Clear transfer instructions
- No payment flow needed - just display info

**2. Card Payment**
- Traditional Paystack checkout
- For users who prefer card payments
- Includes verification polling
- Higher fees apply

## Testing

### Test Mode

When using Paystack test keys:
1. Virtual accounts are created in test mode
2. Use Paystack's test bank accounts to simulate transfers
3. Webhook events are sent to your endpoint
4. All transactions are simulated

### Test Transfers

Paystack provides test account numbers for simulating transfers. Check their documentation for current test account details.

## Troubleshooting

### Account Not Created

**Issue**: Virtual account fails to create

**Solutions**:
- Verify Paystack secret key is configured
- Check user profile has valid email and name
- Ensure preferred bank (Wema Bank) is available
- Review edge function logs

### Wallet Not Credited

**Issue**: Transfer made but wallet not updated

**Solutions**:
- Verify webhook URL is correctly configured on Paystack
- Check webhook signature verification is passing
- Ensure `wallet_recharges` table accepts inserts
- Review webhook function logs
- Confirm Paystack sent the webhook (check dashboard)

### Duplicate Transactions

**Issue**: Same transfer credited multiple times

**Prevention**:
- System checks for existing `payment_reference`
- Webhook returns early if transaction already processed
- Reference is unique per transaction

## Best Practices

1. **Always show virtual account first** - It's the better UX
2. **Keep card payment as backup** - Some users may prefer it
3. **Monitor webhook failures** - Set up alerts for failed webhooks
4. **Test thoroughly** - Use Paystack test mode before going live
5. **Display clear instructions** - Help users understand the process

## Migration to Production

When moving from test to production:

1. Update Paystack keys:
   - Replace test secret key with live key
   - Update in Supabase environment variables

2. Update webhook URL:
   - Use production Supabase URL
   - Re-configure in Paystack dashboard

3. Verify setup:
   - Test account creation with real user
   - Make small test transfer
   - Confirm wallet crediting works

4. Monitor:
   - Watch webhook logs for errors
   - Check transaction records
   - Verify balances match transfers

## Support

For issues with:
- **Virtual account creation**: Check edge function logs
- **Webhook not receiving**: Verify Paystack dashboard webhook config
- **Wallet not crediting**: Review webhook processing logs
- **Paystack errors**: Contact Paystack support with error details
