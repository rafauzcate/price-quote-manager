export interface LineItem {
  id: string;
  product_code: string;
  description: string;
  quantity: number;
  unit_price: number;
  discount_percent: number;
  net_price: number;
}

export interface Quote {
  id: string;
  reference_name: string;
  reference_number: string;
  generated_part_number: string;
  supplier: string;
  part_description: string;
  price: number;
  created_at: string;
  lead_time: string;
  contact_person: string;
  quote_reference?: string;
  quote_date?: string;
  total_net_amount?: number;
  total_vat_amount?: number;
  order_total?: number;
  supplier_contact_name?: string;
  supplier_email?: string;
  supplier_phone?: string;
  line_items?: LineItem[];
  expires_at?: string;
  online_price_found?: number;
  online_price_source?: string;
  online_price_checked_at?: string;
  notes?: string | null;
}

export interface UserProfile {
  id: string;
  name: string;
  company: string;
  last_login: string;
  created_at: string;
  updated_at: string;
  signup_date: string;
  trial_ends_at?: string | null;
  subscription_status?: string;
  is_superadmin?: boolean;
  organization_id?: string | null;
}
