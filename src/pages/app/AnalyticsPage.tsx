import { Copy, Download, FileSpreadsheet, Sparkles } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Bar, BarChart, CartesianGrid, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { toast } from 'sonner';
import type { Quote } from '../../types/app';
import { Card, CardBody, CardHeader } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import { supabase } from '../../lib/supabase';
import { formatCurrency, formatDate } from '../../lib/format';

interface AnalyticsPageProps {
  quotes: Quote[];
}

interface SupplierBarDatum {
  name: string;
  totalValue: number;
  quoteCount: number;
}

interface ExpiringQuote {
  id: string;
  reference: string;
  supplier: string;
  quoteDate: string;
  expiryDate: string;
  daysUntilExpiry: number;
  quote: Quote;
}

export function AnalyticsPage({ quotes }: AnalyticsPageProps) {
  const [rfqModalOpen, setRfqModalOpen] = useState(false);
  const [rfqQuote, setRfqQuote] = useState<Quote | null>(null);
  const [rfqContent, setRfqContent] = useState('');
  const [rfqLoading, setRfqLoading] = useState(false);

  const supplierChartData = useMemo<SupplierBarDatum[]>(() => {
    const grouped = quotes.reduce<Record<string, SupplierBarDatum>>((acc, quote) => {
      const key = quote.supplier || 'Unknown supplier';
      if (!acc[key]) {
        acc[key] = { name: key, totalValue: 0, quoteCount: 0 };
      }
      acc[key].totalValue += Number(quote.order_total || quote.price || 0);
      acc[key].quoteCount += 1;
      return acc;
    }, {});

    return Object.values(grouped)
      .sort((a, b) => b.totalValue - a.totalValue)
      .slice(0, 10);
  }, [quotes]);

  const expiringQuotes = useMemo<ExpiringQuote[]>(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const threshold = new Date(today);
    threshold.setDate(threshold.getDate() + 30);

    return quotes
      .map((quote) => {
        const baseDateRaw = quote.quote_date || quote.created_at;
        if (!baseDateRaw) return null;
        const baseDate = new Date(baseDateRaw);
        if (Number.isNaN(baseDate.getTime())) return null;

        const expiryDate = new Date(baseDate);
        expiryDate.setDate(expiryDate.getDate() + 90);

        if (expiryDate > threshold) {
          return null;
        }

        const diffMs = expiryDate.getTime() - today.getTime();
        const daysUntilExpiry = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

        return {
          id: quote.id,
          reference: quote.reference_name || quote.reference_number,
          supplier: quote.supplier || 'Unknown supplier',
          quoteDate: baseDate.toISOString(),
          expiryDate: expiryDate.toISOString(),
          daysUntilExpiry,
          quote,
        };
      })
      .filter((item): item is ExpiringQuote => !!item)
      .sort((a, b) => a.daysUntilExpiry - b.daysUntilExpiry)
      .slice(0, 20);
  }, [quotes]);

  const generateRfqEmail = async (quote: Quote) => {
    setRfqQuote(quote);
    setRfqModalOpen(true);
    setRfqContent('');
    setRfqLoading(true);

    try {
      const lineItems = (quote.line_items || []).map((item) => ({
        product_code: item.product_code,
        description: item.description,
        quantity: item.quantity,
      }));

      const { data, error } = await supabase.functions.invoke('generate-rfq-email', {
        body: {
          supplier_name: quote.supplier,
          reference: quote.reference_name,
          reference_number: quote.reference_number,
          quote_date: quote.quote_date || quote.created_at,
          line_items: lineItems,
        },
      });

      if (error) {
        throw new Error(error.message);
      }

      setRfqContent(data?.email || data?.content || 'Unable to generate RFQ email.');
      toast.success('RFQ email generated');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to generate RFQ email';
      setRfqContent(`Error: ${message}`);
      toast.error(message);
    } finally {
      setRfqLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-2xl font-bold text-navy-950">Analytics dashboard</h2>
        <div className="flex gap-2">
          <Button variant="outline" leftIcon={<Download size={14} />}>Export PDF</Button>
          <Button variant="outline" leftIcon={<FileSpreadsheet size={14} />}>Export Excel</Button>
        </div>
      </div>

      <Card>
        <CardHeader><h3 className="font-semibold">Top suppliers by total quote value</h3></CardHeader>
        <CardBody className="h-[360px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={supplierChartData} margin={{ top: 20, right: 20, left: 20, bottom: 70 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#d6dee8" />
              <XAxis dataKey="name" angle={-20} textAnchor="end" interval={0} height={80} />
              <YAxis tickFormatter={(value) => `£${Number(value).toLocaleString('en-GB')}`} />
              <Tooltip
                formatter={(value: number, _: string, payload: unknown) => {
                  const quoteCount =
                    payload && typeof payload === 'object' && 'payload' in payload
                      ? Number((payload as { payload?: { quoteCount?: number } }).payload?.quoteCount ?? 0)
                      : 0;
                  return [formatCurrency(Number(value)), `${quoteCount} quotes`];
                }}
                labelFormatter={(label) => `Supplier: ${label}`}
              />
              <Bar dataKey="totalValue" fill="#1a2332" radius={[8, 8, 0, 0]}>
                <LabelList dataKey="quoteCount" position="insideTop" fill="#ffffff" formatter={(value: number) => `${value} quotes`} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <h3 className="font-semibold">Quotes approaching 90-day expiry</h3>
          <p className="text-xs text-slatePremium-500">
            Showing quotes where quote date + 90 days is within the next 30 days (or already overdue).
          </p>
        </CardHeader>
        <CardBody>
          {expiringQuotes.length === 0 ? (
            <p className="text-sm text-slatePremium-500">No quotes currently approaching expiry.</p>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-slatePremium-200">
              <table className="min-w-full text-sm">
                <thead className="bg-slatePremium-50 text-left text-slatePremium-600">
                  <tr>
                    <th className="px-3 py-2">Reference</th>
                    <th className="px-3 py-2">Supplier</th>
                    <th className="px-3 py-2">Quote Date</th>
                    <th className="px-3 py-2">Days Until Expiry</th>
                    <th className="px-3 py-2 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {expiringQuotes.map((row) => {
                    const daysClass = row.daysUntilExpiry < 7 ? 'text-red-600' : row.daysUntilExpiry < 30 ? 'text-amber-600' : 'text-slatePremium-700';
                    return (
                      <tr key={row.id} className="border-t border-slatePremium-100">
                        <td className="px-3 py-2">{row.reference}</td>
                        <td className="px-3 py-2">{row.supplier}</td>
                        <td className="px-3 py-2">{formatDate(row.quoteDate)}</td>
                        <td className={`px-3 py-2 font-semibold ${daysClass}`}>
                          {row.daysUntilExpiry < 0 ? `${Math.abs(row.daysUntilExpiry)} days overdue` : `${row.daysUntilExpiry} days`}
                        </td>
                        <td className="px-3 py-2 text-right">
                          <Button
                            variant="outline"
                            leftIcon={<Sparkles size={14} />}
                            onClick={() => generateRfqEmail(row.quote)}
                          >
                            Generate RFQ
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardBody>
      </Card>

      <Modal open={rfqModalOpen} onClose={() => setRfqModalOpen(false)}>
        <div className="space-y-4 p-6">
          <div>
            <h3 className="text-lg font-semibold text-navy-950">RFQ Email Generator</h3>
            <p className="text-sm text-slatePremium-500">{rfqQuote ? `${rfqQuote.reference_name} · ${rfqQuote.supplier}` : ''}</p>
          </div>

          <textarea
            value={rfqLoading ? 'Generating RFQ email...' : rfqContent}
            readOnly
            rows={14}
            className="w-full rounded-xl border border-slatePremium-300 px-3 py-2 text-sm"
          />

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setRfqModalOpen(false)}>Close</Button>
            <Button
              onClick={async () => {
                if (!rfqContent || rfqContent.startsWith('Error:')) return;
                await navigator.clipboard.writeText(rfqContent);
                toast.success('RFQ email copied to clipboard');
              }}
              leftIcon={<Copy size={14} />}
              disabled={!rfqContent || rfqContent.startsWith('Error:')}
            >
              Copy to Clipboard
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
