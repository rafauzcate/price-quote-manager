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
 * Legacy client helper retained for compatibility.
 * Security hardening: parsing is now performed server-side only in the parse_quote edge function.
 */
export async function parseQuoteClientSide(
  text: string,
  _userId?: string
): Promise<{ success: boolean; data?: ParsedQuote; error?: string }> {
  try {
    const { data, error } = await supabase.functions.invoke('parse_quote', {
      body: { text },
    });

    if (error || data?.error) {
      return {
        success: false,
        error: 'AI parsing service is currently unavailable.',
      };
    }

    return {
      success: true,
      data: validateParsedQuote(data),
    };
  } catch {
    return {
      success: false,
      error: 'AI parsing service is currently unavailable.',
    };
  }
}
