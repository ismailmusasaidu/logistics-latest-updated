# Wallet Withdrawal System Guide

This guide explains how the wallet withdrawal system works and how users can withdraw money from their wallet to their bank account.

## Overview

The withdrawal system allows users to transfer money from their wallet balance to their Nigerian bank account using Paystack's Transfer API. All operations are secure, tracked, and processed automatically.

## Features

### User Features
- Add and verify bank account details
- Request withdrawals to verified bank accounts
- View withdrawal history and status
- Automatic processing (no manual approval needed)
- Transparent fee structure
- Failed withdrawal refunds

### Security Features
- Bank account verification via Paystack
- Minimum withdrawal amount: ₦1,000
- Withdrawal fees based on amount
- Automatic refund on failure
- Complete audit trail
- RLS policies protect user data

## How It Works

### 1. Add Bank Account

**User Flow:**
1. Navigate to profile/wallet section
2. Click "Add Bank Account"
3. Select bank from list of Nigerian banks
4. Enter 10-digit account number
5. System verifies account with Paystack
6. Account name is automatically retrieved
7. Save verified bank account

**Technical Flow:**
```
User Input → resolve-bank-account Edge Function → Paystack API → Verify Account → Save to Database
```

**Bank Account Verification:**
- Uses Paystack Bank Resolve API
- Verifies account number exists
- Returns account holder name
- Prevents typos and fraud

### 2. Request Withdrawal

**User Flow:**
1. Go to wallet section
2. Click "Withdraw" button
3. Select bank account (if multiple)
4. Enter withdrawal amount
5. System shows fee breakdown
6. Confirm withdrawal
7. Money deducted from wallet
8. Withdrawal request created

**Technical Flow:**
```
User Request → request_wallet_withdrawal Function → Deduct from Wallet → Create Withdrawal Record → Queue for Processing
```

**Validation:**
- Minimum amount: ₦1,000
- Maximum: Current wallet balance
- Bank account must be verified
- Sufficient balance check

### 3. Processing Withdrawal

**Automatic Processing:**
1. System retrieves withdrawal request
2. Creates Paystack transfer recipient (if first time)
3. Initiates transfer via Paystack
4. Paystack sends money to bank account
5. Withdrawal marked as completed
6. User notified

**If Processing Fails:**
1. Withdrawal marked as failed
2. Full amount automatically refunded to wallet
3. User notified with failure reason
4. Can retry with same or different bank account

**Technical Flow:**
```
process-withdrawal Edge Function → Create Recipient → Initiate Transfer → Update Status → Notify User
```

## Fee Structure

Withdrawal fees are automatically calculated based on amount:

| Amount Range | Fee |
|--------------|-----|
| ₦1,000 - ₦5,000 | ₦50 |
| ₦5,001 - ₦50,000 | ₦100 |
| Above ₦50,000 | ₦200 |

**Example:**
- Withdrawal Amount: ₦10,000
- Fee: ₦100
- You Receive: ₦9,900

## Database Schema

### user_bank_accounts
```sql
- id (uuid) - Unique identifier
- user_id (uuid) - Owner
- account_number (text) - 10-digit account
- account_name (text) - Account holder name
- bank_name (text) - Bank name
- bank_code (text) - Paystack bank code
- recipient_code (text) - Paystack recipient code
- is_verified (boolean) - Verification status
- is_default (boolean) - Default account flag
- created_at (timestamp)
- updated_at (timestamp)
```

### wallet_withdrawals
```sql
- id (uuid) - Unique identifier
- user_id (uuid) - Requester
- bank_account_id (uuid) - Destination account
- amount (decimal) - Withdrawal amount
- fee (decimal) - Processing fee
- net_amount (decimal) - Amount sent to bank
- status (text) - pending, processing, completed, failed, cancelled
- reference (text) - Unique reference
- paystack_reference (text) - Paystack transfer reference
- failure_reason (text) - Reason if failed
- requested_at (timestamp) - Request time
- processed_at (timestamp) - Processing start
- completed_at (timestamp) - Success time
- failed_at (timestamp) - Failure time
```

## API Methods

### Wallet Service Methods

#### resolveBankAccount(accountNumber, bankCode)
```typescript
const result = await walletService.resolveBankAccount('0123456789', '044');
// Returns: { success: true, accountName: 'John Doe', accountNumber: '0123456789' }
```

#### addBankAccount(userId, accountNumber, accountName, bankName, bankCode)
```typescript
await walletService.addBankAccount(
  userId,
  '0123456789',
  'John Doe',
  'Access Bank',
  '044'
);
```

#### getBankAccounts(userId)
```typescript
const accounts = await walletService.getBankAccounts(userId);
```

#### requestWithdrawal(userId, bankAccountId, amount)
```typescript
const result = await walletService.requestWithdrawal(
  userId,
  bankAccountId,
  10000
);
// Returns: { success: true, withdrawalId, reference, fee: 100, netAmount: 9900 }
```

#### getWithdrawals(userId, limit)
```typescript
const withdrawals = await walletService.getWithdrawals(userId, 20);
```

## Nigerian Banks Supported

All Nigerian banks supported by Paystack:

- Access Bank (044)
- Citibank (023)
- Ecobank (050)
- Fidelity Bank (070)
- First Bank (011)
- First City Monument Bank (214)
- Guaranty Trust Bank (058)
- Heritage Bank (030)
- Keystone Bank (082)
- Polaris Bank (076)
- Providus Bank (101)
- Stanbic IBTC (221)
- Standard Chartered (068)
- Sterling Bank (232)
- Union Bank (032)
- United Bank for Africa (033)
- Unity Bank (215)
- Wema Bank (035)
- Zenith Bank (057)

And many more fintech banks and microfinance banks.

## Security Measures

### Database Security
- RLS policies ensure users only see their data
- Admin access for monitoring and support
- Service role for automated processing
- Unique constraints prevent duplicates

### Payment Security
- All API keys server-side only
- Paystack handles actual money transfer
- Verified bank accounts only
- Amount and balance validation
- Automatic refund on failure

### Audit Trail
- All withdrawals logged in database
- Transaction history maintained
- Status changes timestamped
- Failure reasons recorded
- Complete tracking from request to completion

## Withdrawal Status Flow

```
pending → processing → completed ✓

pending → processing → failed → refunded ✓

pending → cancelled (manual) ✓
```

## Processing Time

- **Account Verification**: Instant (< 2 seconds)
- **Withdrawal Request**: Instant
- **Processing**: Usually instant, max 24 hours
- **Bank Credit**: Usually instant with Nigerian banks, may take 1-2 hours depending on bank

## Monitoring & Support

### Database Queries

**View pending withdrawals:**
```sql
SELECT * FROM wallet_withdrawals
WHERE status = 'pending'
ORDER BY requested_at DESC;
```

**View completed withdrawals today:**
```sql
SELECT COUNT(*), SUM(net_amount)
FROM wallet_withdrawals
WHERE status = 'completed'
AND completed_at >= CURRENT_DATE;
```

**View failed withdrawals:**
```sql
SELECT w.*, b.bank_name, b.account_number
FROM wallet_withdrawals w
JOIN user_bank_accounts b ON w.bank_account_id = b.id
WHERE w.status = 'failed'
ORDER BY w.failed_at DESC;
```

**View user's withdrawal history:**
```sql
SELECT w.*, b.bank_name, b.account_name
FROM wallet_withdrawals w
JOIN user_bank_accounts b ON w.bank_account_id = b.id
WHERE w.user_id = 'user-uuid'
ORDER BY w.requested_at DESC;
```

### Edge Function Logs

Monitor in Supabase Dashboard:
1. Navigate to Edge Functions
2. Select function:
   - `resolve-bank-account` - Bank verification
   - `process-withdrawal` - Transfer processing
3. Check logs for errors

### Paystack Dashboard

Monitor transfers in Paystack:
1. Go to Paystack Dashboard
2. Navigate to Transfers section
3. View all transfer attempts
4. Check for failed transfers
5. View Paystack balance

## Troubleshooting

### Common Issues

**Issue: Account verification fails**
- Solution: Verify account number is exactly 10 digits
- Check bank code is correct
- Ensure account is active
- Try again in a few moments

**Issue: Withdrawal request fails**
- Solution: Check minimum amount (₦1,000)
- Verify sufficient wallet balance
- Ensure bank account is verified
- Check database function permissions

**Issue: Processing fails**
- Automatic refund issued
- Check Paystack balance sufficient
- Verify Paystack API keys
- Review edge function logs
- Contact Paystack support if recurring

**Issue: Money deducted but not received**
- Check withdrawal status in database
- Verify Paystack transfer status
- If completed, check with bank (may take hours)
- If failed, refund is automatic
- Contact support with withdrawal reference

### Manual Processing

If automatic processing fails repeatedly:

1. Check Paystack balance
2. Verify API keys are live (not test)
3. Review edge function logs
4. Manually process via Paystack Dashboard
5. Update withdrawal status in database

### Failed Withdrawal Refund

Refunds are automatic, but can be manually triggered:

```sql
SELECT refund_failed_withdrawal('withdrawal-uuid');
```

This refunds the full amount (including fee) back to user's wallet.

## Best Practices

### For Users
- Verify account details carefully
- Start with small test withdrawal
- Save bank account for future use
- Check withdrawal history regularly
- Contact support if issues persist

### For Admins
- Monitor failed withdrawals daily
- Maintain sufficient Paystack balance
- Set up alerts for failed transfers
- Review processing times
- Keep API keys secure

### For Developers
- Use test keys in development
- Test with various banks
- Handle all error cases
- Implement retry logic
- Log all operations

## Compliance & Regulations

### KYC Requirements
- Users must be registered
- Bank account must be in user's name
- Account verification required
- Anti-fraud measures in place

### Transaction Limits
- Minimum: ₦1,000
- Maximum: Wallet balance
- No daily limit (subject to Paystack limits)
- Paystack may require KYC for large amounts

### Record Keeping
- All transactions logged
- 7-year retention recommended
- Available for audit
- Export capability

## Support Resources

- **Paystack Transfer API**: https://paystack.com/docs/transfers/single-transfers
- **Paystack Banks**: https://paystack.com/docs/transfers/banks
- **Paystack Support**: support@paystack.com
- **Supabase Docs**: https://supabase.com/docs

## Implementation Checklist

Before going live:

- [ ] Test bank account verification with multiple banks
- [ ] Test withdrawal with test Paystack keys
- [ ] Verify automatic refund works for failed withdrawals
- [ ] Switch to live Paystack keys
- [ ] Ensure sufficient Paystack balance
- [ ] Test small real withdrawal
- [ ] Set up monitoring and alerts
- [ ] Document support procedures
- [ ] Train support team
- [ ] Prepare user documentation

## FAQs

**Q: How long does withdrawal take?**
A: Usually instant. Some banks may take up to 24 hours.

**Q: What happens if withdrawal fails?**
A: Full amount (including fee) is automatically refunded to your wallet.

**Q: Can I withdraw to any bank account?**
A: Yes, any Nigerian bank account can be added and verified.

**Q: Is there a limit on withdrawals?**
A: Minimum ₦1,000. Maximum is your current wallet balance.

**Q: Why was my withdrawal rejected?**
A: Check account details, minimum amount, and that your bank account is verified.

**Q: Can I cancel a pending withdrawal?**
A: Contact support immediately. If not yet processed, it can be cancelled.

**Q: Are fees refunded if withdrawal fails?**
A: Yes, the full amount including fees is refunded.

**Q: How do I verify my bank account?**
A: System automatically verifies when you add it using Paystack's verification.

**Q: Can I have multiple bank accounts?**
A: Yes, you can add multiple accounts and set one as default.

**Q: What if I enter wrong account number?**
A: Verification will fail. System won't let you add invalid accounts.
