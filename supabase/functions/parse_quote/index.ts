import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, X-Client-Info, Apikey",
};

const MAX_TEXT_LENGTH = 100000; // 100KB text limit
const HOURLY_RATE_LIMIT = 50;
const DAILY_RATE_LIMIT = 200;

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
  quote_date: string;
  total_net_amount: number;
  total_vat_amount: number;
  order_total: number;
  line_items: LineItem[];
}

async function parseQuoteWithAI(text: string, apiKey: string): Promise<ParsedQuote> {
  const prompt = `You are a quote parsing assistant. Extract ALL information from the provided quote/document text. Return a JSON object with exactly these fields:

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

Quote text to parse:
${text}

Return only valid JSON, no other text.`;

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: "You are a quote parsing assistant. Return only valid JSON.",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
      temperature: 0.3,
    }),
  });

  if (!response.ok) {
    const errorData = await response.text();

    if (response.status === 401) {
      throw new Error('OpenAI API key is invalid. Please check your API key in Settings.');
    }

    if (response.status === 429) {
      throw new Error('OpenAI rate limit exceeded. Please try again later.');
    }

    if (response.status === 403) {
      throw new Error('OpenAI API access denied. Please verify your API key has sufficient credits.');
    }

    throw new Error(`OpenAI API error: ${response.statusText} - ${errorData}`);
  }

  const data = await response.json();
  let content = data.choices[0].message.content;

  // Remove markdown code block formatting if present
  content = content.trim();
  if (content.startsWith('```')) {
    // Remove opening ```json or ```
    content = content.replace(/^```(?:json)?\n?/, '');
    // Remove closing ```
    content = content.replace(/\n?```$/, '');
    content = content.trim();
  }

  const parsed = JSON.parse(content);

  const validateDate = (dateStr: string): string | null => {
    if (!dateStr || dateStr === "Not specified") return null;
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(dateStr)) return null;
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return null;
    return dateStr;
  };

  return {
    supplier: parsed.supplier || "Not specified",
    supplier_contact_name: parsed.supplier_contact_name || "Not specified",
    supplier_email: parsed.supplier_email || "Not specified",
    supplier_phone: parsed.supplier_phone || "Not specified",
    quote_reference: parsed.quote_reference || "Not specified",
    quote_date: validateDate(parsed.quote_date),
    total_net_amount: typeof parsed.total_net_amount === "number" ? parsed.total_net_amount : 0,
    total_vat_amount: typeof parsed.total_vat_amount === "number" ? parsed.total_vat_amount : 0,
    order_total: typeof parsed.order_total === "number" ? parsed.order_total : 0,
    line_items: Array.isArray(parsed.line_items) ? parsed.line_items.map((item: any) => ({
      product_code: item.product_code || "",
      description: item.description || "Not specified",
      quantity: typeof item.quantity === "number" ? item.quantity : 0,
      unit_price: typeof item.unit_price === "number" ? item.unit_price : 0,
      discount_percent: typeof item.discount_percent === "number" ? item.discount_percent : 0,
      net_price: typeof item.net_price === "number" ? item.net_price : 0,
    })) : [],
  };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  const startTime = Date.now();
  let userId: string | null = null;

  try {
    // Get Authorization header
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Authorization required" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Initialize Supabase client with user auth for verification
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      {
        global: {
          headers: { Authorization: authHeader },
        },
      }
    );

    // Verify user authentication
    const {
      data: { user },
      error: authError,
    } = await supabaseClient.auth.getUser();

    if (authError || !user) {
      console.error('Auth error:', authError);
      return new Response(JSON.stringify({ error: "Invalid authentication" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    userId = user.id;

    // Create a service role client for database operations to bypass RLS
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Check rate limits using admin client
    const { data: rateLimitOk, error: rateLimitError } = await supabaseAdmin
      .rpc("check_rate_limit", {
        p_user_id: userId,
        p_endpoint: "parse_quote",
        p_hourly_limit: HOURLY_RATE_LIMIT,
        p_daily_limit: DAILY_RATE_LIMIT,
      });

    if (rateLimitError) {
      console.error("Rate limit check error:", rateLimitError);
    }

    if (rateLimitOk === false) {
      await logApiUsage(supabaseAdmin, userId, "parse_quote", "rate_limited", null, req, startTime);
      return new Response(
        JSON.stringify({
          error: "Rate limit exceeded. Please try again later.",
          hourly_limit: HOURLY_RATE_LIMIT,
          daily_limit: DAILY_RATE_LIMIT
        }),
        {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const { text } = await req.json();

    // Input validation
    if (!text || typeof text !== "string") {
      await logApiUsage(supabaseAdmin, userId, "parse_quote", "validation_error", "Invalid text input", req, startTime);
      return new Response(JSON.stringify({ error: "Invalid text input" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (text.length > MAX_TEXT_LENGTH) {
      await logApiUsage(supabaseAdmin, userId, "parse_quote", "validation_error", "Text too large", req, startTime);
      return new Response(
        JSON.stringify({
          error: `Text too large. Maximum ${MAX_TEXT_LENGTH} characters allowed.`,
          current_size: text.length,
          max_size: MAX_TEXT_LENGTH
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Get user's API key from database using admin client to bypass RLS
    console.log('Attempting to fetch API key for user:', userId);
    const { data: apiKeyData, error: apiKeyError } = await supabaseAdmin
      .from("encrypted_api_keys")
      .select("encrypted_value")
      .eq("user_id", userId)
      .eq("key_name", "openai")
      .maybeSingle();

    console.log('API key fetch result:', {
      hasData: !!apiKeyData,
      error: apiKeyError?.message,
      keyLength: apiKeyData?.encrypted_value?.length
    });

    if (apiKeyError || !apiKeyData) {
      const errorMsg = apiKeyError
        ? `Database error: ${apiKeyError.message}`
        : "OpenAI API key not configured. Please add your API key in settings.";

      console.error('API key retrieval failed:', errorMsg);
      await logApiUsage(supabaseAdmin, userId, "parse_quote", "error", errorMsg, req, startTime);
      return new Response(
        JSON.stringify({ error: errorMsg }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Update last_used_at
    await supabaseAdmin
      .from("encrypted_api_keys")
      .update({ updated_at: new Date().toISOString() })
      .eq("user_id", userId)
      .eq("key_name", "openai");

    const parsed = await parseQuoteWithAI(text, apiKeyData.encrypted_value);

    await logApiUsage(supabaseAdmin, userId, "parse_quote", "success", null, req, startTime);

    return new Response(JSON.stringify(parsed), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error parsing quote:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";

    if (userId) {
      try {
        const supabaseAdmin = createClient(
          Deno.env.get("SUPABASE_URL") ?? "",
          Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
        );
        await logApiUsage(supabaseAdmin, userId, "parse_quote", "error", errorMessage, req, startTime);
      } catch (logError) {
        console.error("Failed to log error:", logError);
      }
    }

    return new Response(
      JSON.stringify({
        error: errorMessage,
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});

async function logApiUsage(
  supabaseClient: any,
  userId: string,
  endpoint: string,
  status: string,
  errorMessage: string | null,
  req: Request,
  startTime: number
) {
  try {
    const responseTime = Date.now() - startTime;
    const requestSize = req.headers.get("content-length")
      ? parseInt(req.headers.get("content-length")!)
      : 0;

    await supabaseClient.from("api_usage_logs").insert({
      user_id: userId,
      endpoint,
      status,
      error_message: errorMessage,
      request_size_bytes: requestSize,
      response_time_ms: responseTime,
      ip_address: req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip"),
    });
  } catch (error) {
    console.error("Failed to log API usage:", error);
  }
}
