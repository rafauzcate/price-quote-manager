import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const TAVILY_API_KEY = Deno.env.get("TAVILY_API_KEY");

interface PriceSearchResult {
  price_found: boolean;
  price?: number;
  source_url?: string;
  source_title?: string;
  checked_at: string;
}

async function searchOnlinePrice(
  supplier: string,
  partDescription: string,
  partNumber: string
): Promise<PriceSearchResult> {
  if (!TAVILY_API_KEY) {
    return {
      price_found: false,
      checked_at: new Date().toISOString(),
    };
  }

  try {
    const searchQuery = `${supplier} ${partNumber} ${partDescription} price buy`;

    const response = await fetch("https://api.tavily.com/search", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        api_key: TAVILY_API_KEY,
        query: searchQuery,
        search_depth: "basic",
        include_answer: false,
        max_results: 5,
      }),
    });

    if (!response.ok) {
      console.error("Tavily API error:", await response.text());
      return {
        price_found: false,
        checked_at: new Date().toISOString(),
      };
    }

    const data = await response.json();

    if (data.results && data.results.length > 0) {
      for (const result of data.results) {
        const priceMatch = extractPrice(result.content + " " + result.title);

        if (priceMatch) {
          return {
            price_found: true,
            price: priceMatch,
            source_url: result.url,
            source_title: result.title,
            checked_at: new Date().toISOString(),
          };
        }
      }
    }

    return {
      price_found: false,
      checked_at: new Date().toISOString(),
    };
  } catch (error) {
    console.error("Error searching online price:", error);
    return {
      price_found: false,
      checked_at: new Date().toISOString(),
    };
  }
}

function extractPrice(text: string): number | null {
  const pricePatterns = [
    /£\s*([0-9,]+\.?[0-9]*)/,
    /\$\s*([0-9,]+\.?[0-9]*)/,
    /€\s*([0-9,]+\.?[0-9]*)/,
    /([0-9,]+\.?[0-9]*)\s*(GBP|USD|EUR)/,
    /price[:\s]+([0-9,]+\.?[0-9]*)/i,
  ];

  for (const pattern of pricePatterns) {
    const match = text.match(pattern);
    if (match && match[1]) {
      const priceStr = match[1].replace(/,/g, '');
      const price = parseFloat(priceStr);
      if (!isNaN(price) && price > 0 && price < 1000000) {
        return price;
      }
    }
  }

  return null;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Authorization required" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      {
        global: {
          headers: { Authorization: authHeader },
        },
      }
    );

    const {
      data: { user },
      error: authError,
    } = await supabaseClient.auth.getUser();

    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Invalid authentication" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { quote_id, supplier, part_description, part_number } = await req.json();

    if (!quote_id || !supplier || !part_description) {
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const searchResult = await searchOnlinePrice(
      supplier,
      part_description,
      part_number || ""
    );

    if (searchResult.price_found && searchResult.price) {
      await supabaseClient
        .from("quotes")
        .update({
          online_price_found: searchResult.price,
          online_price_source: searchResult.source_url,
          online_price_checked_at: searchResult.checked_at,
          last_price_check: searchResult.checked_at,
        })
        .eq("id", quote_id)
        .eq("user_id", user.id);
    } else {
      await supabaseClient
        .from("quotes")
        .update({
          last_price_check: searchResult.checked_at,
        })
        .eq("id", quote_id)
        .eq("user_id", user.id);
    }

    return new Response(JSON.stringify(searchResult), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error in search_online_price:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";

    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
