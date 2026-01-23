# Wallet Security and Implementation Guide

This document details the security measures and implementation of the wallet funding system using Paystack.

## Overview

The wallet system allows customers to fund their wallets using Paystack's secure payment gateway. All sensitive operations are handled server-side through Supabase Edge Functions to ensure API keys remain secure.

## Security Architecture

### 1. Edge Function Security

#### Authentication & Authorization
- **JWT Verification**: The `initialize-wallet-funding` edge function requires JWT authentication
- **User Identity Verification**: User ID is extracted from the authenticated JWT token
- **Profile Verification**: User's profile is verified before payment initialization

#### Input Validation
- **Amount Validation**:
  - Must be a positive number
  - Minimum: ₦100
  - Maximum: ₦1,000,000
- **Type Safety**: All inputs are validated and sanitized
- **SQL Injection Prevention**: Uses parameterized queries through Supabase client

#### Server-Side Processing
```typescript
// Payment initialization happens server-side only
const paystackSecretKey = Deno.env.get("PAYSTACK_SECRET_KEY");
// Secret key NEVER exposed to client
```

### 2. Database Security

#### Row Level Security (RLS)
All wallet-related tables have RLS enabled:

**wallet_recharges table:**
- Users can only view their own recharge records
- Users can only create recharge records for themselves
- Admins can view all recharge records
- Service role (edge functions) can update records

**wallet_transactions table:**
- Users can only view their own transactions
- Transactions are created by database functions, not directly by users
- Admins can view all transactions

#### Database Functions
Security Definer functions ensure atomic operations:

```sql
CREATE OR REPLACE FUNCTION add_wallet_balance(
  p_user_id UUID,
  p_amount DECIMAL,
  p_description TEXT,
  p_reference_type TEXT DEFAULT 'recharge'
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
```

- **Atomic Transactions**: Balance updates and transaction records are created atomically
- **Row Locking**: `FOR UPDATE` prevents race conditions
- **Rollback on Error**: Ensures data consistency

### 3. Payment Verification Security

#### Double Verification
1. **Server-Side Verification**: Payment is verified with Paystack API
2. **Amount Matching**: Paid amount is compared with expected amount
3. **Status Checking**: Only "success" status credits the wallet
4. **Idempotency**: Duplicate verifications are handled gracefully

#### Reference Validation
```typescript
if (!reference.startsWith("wallet_")) {
  return error; // Only wallet funding references accepted
}
```

#### Transaction Tracking
- All payment attempts are logged in `wallet_recharges` table
- Failed payments are marked and timestamped
- Successful payments include Paystack reference for audit

### 4. Client-Side Security

#### Secure Communication
```typescript
const { data: { session } } = await supabase.auth.getSession();
if (!session) {
  throw new Error('Not authenticated');
}

const response = await fetch(apiUrl, {
  headers: {
    'Authorization': `Bearer ${session.access_token}`,
    'Content-Type': 'application/json',
  },
});
```

#### No Sensitive Data Exposure
- API keys are never sent to or stored on the client
- Payment processing happens in secure Paystack environment
- Client only receives authorization URL and reference

#### Payment Flow
1. User enters amount
2. Client calls edge function (with JWT)
3. Edge function initializes payment with Paystack
4. User redirected to Paystack (secure SSL)
5. Payment verification happens server-side
6. Wallet credited automatically

## Implementation Details

### Edge Functions

#### initialize-wallet-funding
**Purpose**: Securely initialize wallet funding with Paystack

**Security Features:**
- Requires JWT authentication
- Validates amount (min/max)
- Creates recharge record before payment
- Returns only authorization URL (no sensitive data)

**Request:**
```json
{
  "amount": 1000
}
```

**Response:**
```json
{
  "success": true,
  "authorizationUrl": "https://checkout.paystack.com/...",
  "reference": "wallet_user123_1234567890",
  "amount": 1000
}
```

#### verify-wallet-funding
**Purpose**: Verify payment completion and credit wallet

**Security Features:**
- Uses service role key (server-side only)
- Validates payment with Paystack API
- Verifies amount matches expected amount
- Atomic wallet credit operation
- Idempotent (safe to call multiple times)

**Request:**
```json
{
  "reference": "wallet_user123_1234567890"
}
```

**Response:**
```json
{
  "success": true,
  "verified": true,
  "message": "Wallet funded successfully",
  "amount": 1000,
  "reference": "wallet_user123_1234567890"
}
```

### Database Schema

#### wallet_recharges Table
```sql
CREATE TABLE wallet_recharges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  amount DECIMAL(10,2) NOT NULL CHECK (amount > 0),
  reference TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL CHECK (status IN ('pending', 'completed', 'failed')),
  paystack_reference TEXT,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  completed_at TIMESTAMPTZ,
  failed_at TIMESTAMPTZ
);
```

**Indexes:**
- `user_id` - Fast user lookups
- `reference` - Fast payment verification
- `status` - Filtering by status
- `created_at` - Chronological ordering

#### wallet_transactions Table
Already exists - tracks all wallet activity including:
- Recharges (credit)
- Order payments (debit)
- Refunds (credit)
- Admin adjustments

### Client Components

#### WalletFundingModal
**Features:**
- Input validation
- Quick amount selection
- Automatic payment verification polling
- Manual verification option
- Loading and error states
- User-friendly error messages

**User Experience:**
1. User opens funding modal
2. Enters or selects amount
3. Clicks "Continue to Payment"
4. Redirected to Paystack
5. Completes payment
6. Automatically verified and wallet credited
7. Success notification shown

## Security Best Practices

### DO's
✅ Always validate input on both client and server
✅ Use parameterized queries (Supabase client handles this)
✅ Keep API keys in environment variables (edge function secrets)
✅ Verify payments server-side only
✅ Use atomic database transactions
✅ Log all payment attempts for audit
✅ Implement rate limiting (Supabase handles this)
✅ Use HTTPS for all communications (automatic)
✅ Validate payment amount matches expected amount
✅ Handle edge cases (duplicate payments, failures, etc.)

### DON'Ts
❌ Never expose Paystack secret key to client
❌ Never trust client-side payment verification
❌ Never skip amount validation
❌ Never allow direct database writes for sensitive operations
❌ Never ignore failed payment callbacks
❌ Never store sensitive payment data in logs
❌ Never hardcode API keys in code
❌ Never skip RLS policies

## Testing

### Test Cards (Use in development)
Paystack provides test cards for development:

| Card Number | CVV | Expiry | Result |
|-------------|-----|--------|--------|
| 4084 0840 8408 4081 | Any | Future | Success |
| 5060 6666 6666 6666 | Any | Future | Insufficient Funds |
| 5090 8888 8888 8888 | Any | Future | Declined |

### Test Scenarios
1. **Successful Payment**
   - Enter valid amount
   - Use success test card
   - Verify wallet is credited
   - Check transaction history

2. **Failed Payment**
   - Enter valid amount
   - Use declined test card
   - Verify wallet is not credited
   - Check error handling

3. **Abandoned Payment**
   - Start payment flow
   - Close Paystack window
   - Verify payment marked as failed/pending
   - Try manual verification

4. **Duplicate Verification**
   - Complete successful payment
   - Call verification again
   - Verify idempotent behavior

5. **Amount Validation**
   - Try amount < ₦100
   - Try amount > ₦1,000,000
   - Try negative amount
   - Try non-numeric input

## Monitoring and Audit

### Database Queries for Monitoring

**View all pending payments:**
```sql
SELECT * FROM wallet_recharges
WHERE status = 'pending'
ORDER BY created_at DESC;
```

**View failed payments:**
```sql
SELECT * FROM wallet_recharges
WHERE status = 'failed'
ORDER BY failed_at DESC;
```

**View user's recharge history:**
```sql
SELECT * FROM wallet_recharges
WHERE user_id = 'user-uuid'
ORDER BY created_at DESC;
```

**View successful recharges today:**
```sql
SELECT COUNT(*), SUM(amount)
FROM wallet_recharges
WHERE status = 'completed'
AND completed_at >= CURRENT_DATE;
```

### Edge Function Logs

Monitor edge function logs in Supabase Dashboard:
1. Navigate to Edge Functions
2. Select function (initialize-wallet-funding or verify-wallet-funding)
3. View logs tab
4. Filter by error/warning levels

## Production Checklist

Before going live:

- [ ] Replace test Paystack keys with live keys
- [ ] Test with real small transactions
- [ ] Set up Paystack webhook for real-time notifications (optional)
- [ ] Configure email notifications for failed payments
- [ ] Set up monitoring and alerting
- [ ] Review and test all RLS policies
- [ ] Verify all edge functions are deployed
- [ ] Test all error scenarios
- [ ] Review transaction logs
- [ ] Set up backup and recovery procedures
- [ ] Document incident response procedures
- [ ] Train support team on wallet issues

## Support and Troubleshooting

### Common Issues

**Payment not credited:**
1. Check wallet_recharges table for record status
2. Verify payment in Paystack Dashboard
3. Call verify-wallet-funding edge function manually
4. Check edge function logs for errors

**Payment verification stuck:**
1. Check network connectivity
2. Verify Paystack API is accessible
3. Check edge function timeout settings
4. Review error logs

**Amount mismatch:**
1. This is a security feature
2. Payment is rejected to prevent fraud
3. Contact user to retry payment
4. Log issue for investigation

## Contact and Resources

- **Paystack Documentation**: https://paystack.com/docs
- **Supabase Documentation**: https://supabase.com/docs
- **Edge Functions Guide**: https://supabase.com/docs/guides/functions
- **Security Best Practices**: https://supabase.com/docs/guides/auth/security

## Changelog

### v1.0.0 - Initial Implementation
- Wallet funding via Paystack
- Secure edge function implementation
- RLS policies for all wallet tables
- Audit trail for all transactions
- Client-side funding modal
- Automatic payment verification
