import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'jsr:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');

interface RfqLineItem {
  product_code?: string;
  description?: string;
  quantity?: number;
}

function buildLineItemText(lineItems: RfqLineItem[]): string {
  if (!Array.isArray(lineItems) || lineItems.length === 0) {
    return '- Please provide an updated quotation for the original quoted items.';
  }

  return lineItems
    .map((item, index) => {
      const description = (item.description || '').trim() || 'Unnamed item';
      const productCode = (item.product_code || '').trim();
      const quantity = Number(item.quantity || 0);
      const quantityText = Number.isFinite(quantity) && quantity > 0 ? `Qty: ${quantity}` : 'Qty: N/A';
      const productCodeText = productCode ? ` | Code: ${productCode}` : '';
      return `${index + 1}. ${description}${productCodeText} | ${quantityText}`;
    })
    .join('\n');
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Authorization required' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: authHeader },
        },
      },
    );

    const {
      data: { user },
      error: authError,
    } = await supabaseClient.auth.getUser();

    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Invalid authentication' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!OPENAI_API_KEY) {
      return new Response(JSON.stringify({ error: 'OPENAI_API_KEY is not configured' }), {
        status: 503,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { supplier_name, reference, reference_number, quote_date, line_items } = await req.json();

    if (!supplier_name || (!reference && !reference_number)) {
      return new Response(JSON.stringify({ error: 'Missing required fields' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const lineItemsText = buildLineItemText(line_items || []);
    const resolvedReference = reference || reference_number;

    const prompt = `Generate a professional RFQ (Request for Quotation) email to supplier ${supplier_name}.
Context: Original quote ${resolvedReference} dated ${quote_date || 'N/A'} is approaching 90 days old.
Request: Updated pricing for the following items:
${lineItemsText}
Tone: Professional, courteous, business-formal
Exclude: Any internal notes or comments
Format: Ready to copy and send`;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        temperature: 0.2,
        messages: [
          {
            role: 'system',
            content:
              'You write concise, professional procurement emails. Return plain email text only, no markdown fences.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      return new Response(JSON.stringify({ error: `OpenAI error: ${response.status} ${errorText}` }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const data = await response.json();
    const email = data?.choices?.[0]?.message?.content?.trim();

    return new Response(JSON.stringify({ email }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
