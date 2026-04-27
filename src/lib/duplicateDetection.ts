import { supabase } from './supabase';

export interface DuplicateFileWarning {
  isDuplicate: boolean;
  existingQuotes: Array<{
    id: string;
    reference_name: string;
    reference_number: string;
    supplier: string;
    created_at: string;
  }>;
}

export interface SimilarItemWarning {
  hasSimilarItems: boolean;
  similarItems: Array<{
    description: string;
    quote_reference_name: string;
    quote_reference_number: string;
    supplier: string;
    quantity: number;
    unit_price: number;
  }>;
}

export async function generateFileHash(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  return hashHex;
}

export async function checkDuplicateFile(fileHash: string): Promise<DuplicateFileWarning> {
  const { data: user } = await supabase.auth.getUser();
  if (!user.user) {
    return { isDuplicate: false, existingQuotes: [] };
  }

  const { data, error } = await supabase
    .from('quotes')
    .select('id, reference_name, reference_number, supplier, created_at')
    .eq('user_id', user.user.id)
    .eq('file_hash', fileHash)
    .order('created_at', { ascending: false });

  if (error || !data || data.length === 0) {
    return { isDuplicate: false, existingQuotes: [] };
  }

  return {
    isDuplicate: true,
    existingQuotes: data,
  };
}

export async function findSimilarItems(descriptions: string[]): Promise<SimilarItemWarning> {
  const { data: user } = await supabase.auth.getUser();
  if (!user.user || descriptions.length === 0) {
    return { hasSimilarItems: false, similarItems: [] };
  }

  const similarItems: SimilarItemWarning['similarItems'] = [];

  for (const description of descriptions) {
    if (!description || description.trim().length < 10) continue;

    const words = description
      .toLowerCase()
      .split(/\s+/)
      .filter(word => word.length > 3)
      .slice(0, 5);

    if (words.length === 0) continue;

    const searchPattern = words.map(word => `%${word}%`).join('');

    const { data, error } = await supabase
      .from('quote_line_items')
      .select(`
        description,
        quantity,
        unit_price,
        quotes!inner(
          reference_name,
          reference_number,
          supplier,
          user_id
        )
      `)
      .eq('quotes.user_id', user.user.id)
      .ilike('description', searchPattern)
      .limit(5);

    if (!error && data) {
      data.forEach((item: any) => {
        const similarity = calculateSimilarity(description, item.description);
        if (similarity > 0.6) {
          similarItems.push({
            description: item.description,
            quote_reference_name: item.quotes.reference_name,
            quote_reference_number: item.quotes.reference_number,
            supplier: item.quotes.supplier,
            quantity: parseFloat(item.quantity),
            unit_price: parseFloat(item.unit_price),
          });
        }
      });
    }
  }

  return {
    hasSimilarItems: similarItems.length > 0,
    similarItems: similarItems.slice(0, 10),
  };
}

function calculateSimilarity(str1: string, str2: string): number {
  const s1 = str1.toLowerCase().trim();
  const s2 = str2.toLowerCase().trim();

  if (s1 === s2) return 1;

  const words1 = new Set(s1.split(/\s+/).filter(w => w.length > 3));
  const words2 = new Set(s2.split(/\s+/).filter(w => w.length > 3));

  if (words1.size === 0 || words2.size === 0) return 0;

  const intersection = new Set([...words1].filter(w => words2.has(w)));
  const union = new Set([...words1, ...words2]);

  return intersection.size / union.size;
}
