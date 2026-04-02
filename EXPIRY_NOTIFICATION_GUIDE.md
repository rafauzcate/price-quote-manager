# Quote Expiry Notification System

## Overview
This system automatically tracks quote expiry dates and notifies users when quotes become outdated (after 6 months). It also provides functionality to search for updated prices online.

## Features

### 1. Automatic Expiry Tracking
- All quotes automatically set `expires_at` to 6 months from creation date
- Existing quotes are backfilled with expiry dates
- Database trigger ensures new quotes get expiry dates automatically

### 2. Expired Quotes Banner
- Displays a prominent banner when quotes are expired
- Shows list of expired quotes with days expired
- Users can dismiss the notification (marks quotes as notified)
- Banner appears at the top of the main dashboard

### 3. Online Price Search
- Each expired quote has a "Search Online" button
- Uses Tavily API to search for current prices on the web
- Automatically extracts prices from search results
- Supports multiple currency formats (£, $, €)
- Updates quote with found price and source

### 4. Price Comparison Display
- Shows original quote price vs. current online price
- Visual indicators for price changes (up/down/similar)
- Displays percentage difference
- Links to the source website
- Color-coded alerts (green for lower, red for higher, gray for similar)

## Database Schema

### New Columns in `quotes` Table
```sql
expires_at timestamptz              -- When quote expires (6 months from created_at)
is_expired_notified boolean         -- Whether user has been notified
last_price_check timestamptz        -- Last price check timestamp
online_price_found numeric          -- Latest price found online
online_price_source text            -- Source URL of the price
online_price_checked_at timestamptz -- When the price was checked
```

### Functions
- `set_quote_expiry()` - Trigger function to set expiry on insert
- `get_expired_quotes(user_id)` - Returns all expired unnotified quotes for a user

## Components

### ExpiredQuotesBanner
Location: `src/components/ExpiredQuotesBanner.tsx`
- Fetches expired quotes on mount
- Displays notification banner
- Handles dismissal and price search

### PriceComparison
Location: `src/components/PriceComparison.tsx`
- Displays price comparison UI
- Shows original vs. online price
- Calculates and displays differences
- Links to source

## Edge Function

### search_online_price
Location: `supabase/functions/search_online_price/index.ts`
- Authenticates user
- Searches Tavily API for product prices
- Extracts prices from search results
- Updates quote with findings

## Testing the System

### To manually test expiry notifications:

1. **Set a quote to be expired (via Supabase SQL Editor):**
```sql
UPDATE quotes
SET expires_at = now() - interval '1 day',
    is_expired_notified = false
WHERE id = 'YOUR_QUOTE_ID';
```

2. **Refresh the application dashboard**
   - You should see the expired quotes banner appear
   - The banner will list all expired quotes

3. **Test online price search:**
   - Click "Search Online" button on an expired quote
   - The system will search for current prices
   - If found, the price comparison will appear in the quote details

### To view all expired quotes for a user:
```sql
SELECT * FROM get_expired_quotes('USER_ID');
```

### To reset notifications:
```sql
UPDATE quotes
SET is_expired_notified = false
WHERE user_id = 'USER_ID';
```

## Rate Limiting
The online price search is subject to:
- Overall API rate limits (50/hour, 200/day)
- Each search counts as one API call
- Users will see a loading spinner during search

## Privacy & Security
- All price searches are authenticated
- Only users can search prices for their own quotes
- API keys are stored securely in environment variables
- Search results are logged in audit trail

## Future Enhancements
- Scheduled background price checks
- Email notifications for expired quotes
- Bulk price search for multiple quotes
- Price history tracking
- Automated re-quoting workflow
