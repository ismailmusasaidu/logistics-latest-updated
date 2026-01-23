# Google Maps API Setup Guide

The delivery app uses Google Distance Matrix API to calculate accurate delivery distances and routes. Follow these steps to set it up:

## Step 1: Get a Google Maps API Key

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Enable the following APIs:
   - **Distance Matrix API**
   - **Geocoding API**
4. Go to "Credentials" and create an API Key
5. (Optional but recommended) Restrict the API key:
   - Set application restrictions to your domain
   - Restrict API key to only Distance Matrix API and Geocoding API

## Step 2: Add API Key to Supabase

You need to add the Google Maps API key as a secret in your Supabase project:

### Using Supabase Dashboard:
1. Go to your project settings
2. Navigate to "Edge Functions" section
3. Click on "Manage secrets"
4. Add a new secret:
   - Name: `GOOGLE_MAPS_API_KEY`
   - Value: Your Google Maps API key

### Using Supabase CLI (if you have it installed locally):
```bash
supabase secrets set GOOGLE_MAPS_API_KEY=your_api_key_here
```

## Step 3: Verify Setup

After adding the API key:
1. Try creating a new order with detailed addresses
2. The system should now calculate distances automatically
3. Example addresses that work well:
   - "10 Admiralty Way, near Mega Chicken, Lekki Phase 1, Lagos, Nigeria"
   - "Plot 1234, opposite Eko Hotel, Victoria Island, Lagos, Nigeria"

## Important Notes

- Always include landmarks and area names in addresses for better accuracy
- The API uses driving distance, not straight-line distance
- Make sure your Google Cloud billing is enabled (they offer free tier credits)
- Monitor your API usage to avoid unexpected charges

## Troubleshooting

**Error: "Unable to find address"**
- Make sure the API key is correctly set in Supabase secrets
- Verify the API key has Distance Matrix API and Geocoding API enabled
- Check that billing is enabled in Google Cloud Console
- Use more detailed addresses with landmarks and area names

**Distance calculations not working**
- Wait 1-2 minutes after setting the secret for it to propagate
- Redeploy the calculate-distance edge function if needed
- Check the Supabase Edge Function logs for detailed error messages
