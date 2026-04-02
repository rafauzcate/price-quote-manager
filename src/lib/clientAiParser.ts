/**
 * Client-side AI parsing module.
 * This is used as a fallback when the Supabase Edge Function is unavailable (401/deploy issues).
 * It calls OpenAI directly from the browser using the user's stored API key.
 */

import { supabase } from './supabase';

interface LineItem {
  product_code: string;
  description: string;
  quantity: number;
  unit_price: number;
  discount_percent: number;
  net_price: number;
}

interface ParsedQuote {
  supplier: string;
  supplier_contact_name: string;
  supplier_email: string;
  supplier_phone: string;
  quote_reference: string;
  quote_date: string | null;
  total_net_amount: number;
  total_vat_amount: number;
  order_total: number;
  line_items: LineItem[];
}

const PARSE_PROMPT = `You are a quote parsing assistant. Extract ALL information from the provided quote/document text. Return a JSON object with exactly these fields:

- supplier: name of the company providing the quote (the supplier/vendor company name) (string)
- supplier_contact_name: name of the supplier's contact person if available (string)
- supplier_email: email address of the supplier (string)
- supplier_phone: phone number of the supplier (string)
- quote_reference: the quote reference number or subject line reference (string)
- quote_date: date of the quote in YYYY-MM-DD format (string)
- total_net_amount: sum of all line item net_prices (number, MUST equal sum of all net_price values)
- total_vat_amount: VAT amount if stated, otherwise 0 (number)
- order_total: total_net_amount + total_vat_amount (number)
- line_items: array of ALL line items

Each line item must have:
  - product_code: product code/SKU/part number (string, use "" if none)
  - description: full product description including category and size info (string)
  - quantity: COUNT of items ordered (number, default 1 if not stated)
  - unit_price: price per single unit (number)
  - discount_percent: discount percentage (number, 0 if none)
  - net_price: MUST equal quantity × unit_price × (1 - discount_percent/100), always recalculate this

CRITICAL CALCULATION RULES:
- net_price for each line = quantity × unit_price × (1 - discount_percent/100). ALWAYS compute this, do not guess.
- total_net_amount = SUM of ALL net_price values across all line items. ALWAYS recompute this by adding up every net_price.
- order_total = total_net_amount + total_vat_amount
- If a price is stated as "X each" and quantity is Y, then unit_price = X and net_price = X × Y.

DOCUMENT TYPE HANDLING:

1. EMAIL/NARRATIVE QUOTES (e.g. "28 off GA5639-12 - SPB03-B-12-6X25-4X20 -- £3,510.00 each"):
   - Parse sentences like "N off PART_CODE -- £PRICE each": quantity=N, unit_price=PRICE, net_price=N×PRICE
   - The supplier is the company who SENT the quote email (the From: address company), not the customer
   - Use the email subject or reference number as quote_reference
   - Use the email date as quote_date

2. CSV/SPREADSHEET PRICE LISTS (columns like DN Size, Category, Description, Price):
   - Each row is a separate line item
   - quantity defaults to 1 unless a quantity column is present
   - unit_price = the quoted unit price column value
   - net_price = quantity × unit_price (since no explicit qty, net_price = unit_price)
   - Combine category + description columns into the description field
   - The document may not have a named supplier — use any company name found or "Not specified"

3. FORMAL INVOICES/PURCHASE ORDERS (structured tables with qty, unit price, totals):
   - Map columns carefully: qty column → quantity, unit price column → unit_price
   - net_price column → verify it equals qty × unit_price
   - Use stated totals if they match; if they don't match, recalculate from line items

IMPORTANT RULES:
- Extract EVERY line item — do not skip any rows.
- IGNORE customer contact details. Only capture SUPPLIER contact info (the company providing the quote).
- quantity is ALWAYS a count (1, 2, 28, etc.), NEVER a percentage or price.
- discount_percent is ALWAYS 0–100, NEVER a price.
- If total_net_amount is not stated, compute it by summing all net_price values.

Default values when field cannot be determined:
- strings: "Not specified"
- numbers: 0
- line_items: []

Return only valid JSON, no other text.`;

/**
 * Fetches the user's OpenAI API key from the database.
 */
async function getUserApiKey(userId: string): Promise<string | null> {
  try {
    const { data, error } = await supabase
      .from('encrypted_api_keys')
      .select('encrypted_value')
      .eq('user_id', userId)
      .eq('key_name', 'openai')
      .maybeSingle();

    if (error || !data) {
      console.warn('No OpenAI API key found for user');
      return null;
    }

    return data.encrypted_value;
  } catch (err) {
    console.error('Failed to fetch API key:', err);
    return null;
  }
}

/**
 * Validates and cleans the parsed response from OpenAI.
 */
function validateParsedQuote(parsed: any): ParsedQuote {
  const validateDate = (dateStr: string): string | null => {
    if (!dateStr || dateStr === 'Not specified') return null;
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(dateStr)) return null;
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return null;
    return dateStr;
  };

  return {
    supplier: parsed.supplier || 'Not specified',
    supplier_contact_name: parsed.supplier_contact_name || 'Not specified',
    supplier_email: parsed.supplier_email || 'Not specified',
    supplier_phone: parsed.supplier_phone || 'Not specified',
    quote_reference: parsed.quote_reference || 'Not specified',
    quote_date: validateDate(parsed.quote_date),
    total_net_amount: typeof parsed.total_net_amount === 'number' ? parsed.total_net_amount : 0,
    total_vat_amount: typeof parsed.total_vat_amount === 'number' ? parsed.total_vat_amount : 0,
    order_total: typeof parsed.order_total === 'number' ? parsed.order_total : 0,
    line_items: Array.isArray(parsed.line_items)
      ? parsed.line_items.map((item: any) => ({
          product_code: item.product_code || '',
          description: item.description || 'Not specified',
          quantity: typeof item.quantity === 'number' ? item.quantity : 0,
          unit_price: typeof item.unit_price === 'number' ? item.unit_price : 0,
          discount_percent: typeof item.discount_percent === 'number' ? item.discount_percent : 0,
          net_price: typeof item.net_price === 'number' ? item.net_price : 0,
        }))
      : [],
  };
}

/**
 * Parses a quote using OpenAI directly from the client side.
 * This is the fallback when the Supabase Edge Function is unavailable.
 */
export async function parseQuoteClientSide(
  text: string,
  userId: string
): Promise<{ success: boolean; data?: ParsedQuote; error?: string }> {
  // 1. Get API key
  const apiKey = await getUserApiKey(userId);

  if (!apiKey) {
    return {
      success: false,
      error:
        'No OpenAI API key found. Please go to Settings (gear icon) and add your OpenAI API key to enable AI-powered quote parsing.',
    };
  }

  // 2. Truncate text if too long
  const maxLength = 100000;
  const truncatedText = text.length > maxLength ? text.substring(0, maxLength) : text;

  // 3. Call OpenAI directly
  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: 'You are a quote parsing assistant. Return only valid JSON.',
          },
          {
            role: 'user',
            content: `${PARSE_PROMPT}\n\nQuote text to parse:\n${truncatedText}`,
          },
        ],
        temperature: 0.3,
      }),
    });

    if (!response.ok) {
      if (response.status === 401) {
        return {
          success: false,
          error:
            'Your OpenAI API key is invalid or expired. Please update it in Settings.',
        };
      }
      if (response.status === 429) {
        return {
          success: false,
          error: 'OpenAI rate limit exceeded. Please wait a moment and try again.',
        };
      }
      if (response.status === 403) {
        return {
          success: false,
          error:
            'OpenAI API access denied. Please check your API key has sufficient credits.',
        };
      }
      const errorText = await response.text();
      return {
        success: false,
        error: `OpenAI API error (${response.status}): ${errorText}`,
      };
    }

    const data = await response.json();
    let content = data.choices[0].message.content;

    // Remove markdown code block formatting if present
    content = content.trim();
    if (content.startsWith('```')) {
      content = content.replace(/^```(?:json)?\n?/, '');
      content = content.replace(/\n?```$/, '');
      content = content.trim();
    }

    const parsed = JSON.parse(content);
    const validated = validateParsedQuote(parsed);

    return { success: true, data: validated };
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : 'Unknown error during AI parsing';
    console.error('Client-side AI parsing error:', err);
    return { success: false, error: errorMsg };
  }
}
