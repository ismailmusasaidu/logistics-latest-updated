# Logistics Delivery App

A comprehensive delivery management application built with React Native Expo, featuring customer orders, rider management, admin controls, and secure online payments.

## Features

### Customer Features
- Place single or bulk delivery orders
- Real-time order tracking
- Multiple payment methods:
  - **Online Payment** - Secure card payments via Paystack
  - **Wallet** - Quick payment using wallet balance
  - **Bank Transfer** - Pay via bank transfer with reference tracking
  - **Cash on Delivery** - Pay when you receive
- Apply promo codes for discounts
- View order history and tracking details

### Rider Features
- View available and assigned deliveries
- Accept/reject delivery requests
- Real-time order tracking
- Earnings and wallet management
- Profile verification system

### Admin Features
- Comprehensive dashboard with statistics
- Manage orders, riders, and users
- Configure dynamic pricing
- Bank account management for transfers
- Rider approval and verification
- Promo code management

## Payment Integration

The app supports secure online payments through **Paystack**. All payment processing is handled server-side using Supabase Edge Functions to ensure API keys remain secure.

### Setup Online Payments

For complete Paystack configuration instructions, see:

📖 **[PAYSTACK_SETUP.md](./PAYSTACK_SETUP.md)** - Detailed setup guide with test cards and troubleshooting

Quick setup:
1. Get your Paystack API keys from https://dashboard.paystack.co
2. Add `PAYSTACK_SECRET_KEY` to Supabase Edge Functions secrets
3. Test with Paystack test cards
4. Switch to live keys for production

## Getting Started

### Prerequisites
- Node.js 18+
- Expo CLI
- Supabase account
- Paystack account (for online payments)

### Installation

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```

3. Configure environment variables:
   - Supabase credentials are in `.env`
   - Add Paystack secret key to Supabase Edge Functions (see PAYSTACK_SETUP.md)

4. Run the app:
   ```bash
   npm run dev
   ```

## Database

The database schema is managed through Supabase migrations in `supabase/migrations/`.

## Security

- All payment processing happens server-side via Supabase Edge Functions
- API keys are never exposed to the client
- Row Level Security (RLS) policies protect user data
- Payment verification is performed server-side
- JWT authentication required for payment initialization

## Tech Stack

- **Frontend**: React Native, Expo
- **Backend**: Supabase (PostgreSQL, Edge Functions)
- **Payment**: Paystack
- **Authentication**: Supabase Auth
- **Real-time**: Supabase Realtime

## Edge Functions

The following edge functions are deployed:

- **initialize-payment** - Securely initialize Paystack transactions
- **verify-payment** - Verify payment completion with Paystack

## Support

For payment setup and troubleshooting, refer to [PAYSTACK_SETUP.md](./PAYSTACK_SETUP.md)
