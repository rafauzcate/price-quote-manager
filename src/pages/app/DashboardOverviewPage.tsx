import { Activity, FileText, PoundSterling, Timer } from 'lucide-react';
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis, PieChart, Pie, Cell } from 'recharts';
import { Card, CardBody, CardHeader } from '../../components/ui/Card';
import { formatCurrency } from '../../lib/format';
import type { Quote } from '../../types/app';

interface DashboardOverviewPageProps {
  quotes: Quote[];
  loading?: boolean;
}

const pieColors = ['#D4AF37', '#2D3E50', '#1a2332'];

export function DashboardOverviewPage({ quotes, loading }: DashboardOverviewPageProps) {
  const totalValue = quotes.reduce((sum, quote) => sum + (quote.order_total || quote.price || 0), 0);
  const pendingQuotes = quotes.filter((q) => !q.quote_date).length;
  const expired = quotes.filter((q) => q.expires_at && new Date(q.expires_at).getTime() < Date.now()).length;

  const quoteTrend = Object.values(
    quotes.reduce<Record<string, { date: string; count: number }>>((acc, quote) => {
      const key = new Date(quote.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
      acc[key] = acc[key] || { date: key, count: 0 };
      acc[key].count += 1;
      return acc;
    }, {}),
  ).slice(-8);

  const byStatus = [
    { name: 'Active', value: Math.max(quotes.length - expired, 0) },
    { name: 'Expired', value: expired },
    { name: 'Pending', value: pendingQuotes },
  ];

  const kpis = [
    { label: 'Total Quotes', value: quotes.length, icon: FileText },
    { label: 'Pending Quotes', value: pendingQuotes, icon: Timer },
    { label: 'Expired Quotes', value: expired, icon: Activity },
    { label: 'Quote Value', value: formatCurrency(totalValue), icon: PoundSterling },
  ];

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {kpis.map((kpi) => (
          <Card key={kpi.label}>
            <CardBody className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-wider text-slatePremium-500">{kpi.label}</p>
                <p className="mt-2 text-2xl font-bold text-navy-950">{kpi.value}</p>
              </div>
              <div className="rounded-xl bg-navy-950/5 p-3 text-navy-800">
                <kpi.icon size={20} />
              </div>
            </CardBody>
          </Card>
        ))}
      </div>

      <div className="grid gap-5 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader>
            <h3 className="font-semibold text-navy-950">Quote trends</h3>
          </CardHeader>
          <CardBody className="h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={quoteTrend}>
                <defs>
                  <linearGradient id="trend" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#D4AF37" stopOpacity={0.8} />
                    <stop offset="95%" stopColor="#D4AF37" stopOpacity={0.1} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="date" stroke="#8fa2b8" />
                <YAxis stroke="#8fa2b8" />
                <Tooltip />
                <Area type="monotone" dataKey="count" stroke="#1a2332" fill="url(#trend)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <h3 className="font-semibold text-navy-950">Status distribution</h3>
          </CardHeader>
          <CardBody className="h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={byStatus} dataKey="value" nameKey="name" innerRadius={55} outerRadius={90}>
                  {byStatus.map((_, index) => (
                    <Cell key={index} fill={pieColors[index % pieColors.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardBody>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <h3 className="font-semibold text-navy-950">Recent activity</h3>
        </CardHeader>
        <CardBody>
          <ul className="space-y-3">
            {(quotes.slice(0, 5) || []).map((quote) => (
              <li key={quote.id} className="flex items-start justify-between rounded-xl border border-slatePremium-200 p-3">
                <div>
                  <p className="font-medium text-slatePremium-900">{quote.reference_name} · {quote.supplier}</p>
                  <p className="text-sm text-slatePremium-500">Quote created {new Date(quote.created_at).toLocaleString()}</p>
                </div>
                <p className="text-sm font-semibold text-navy-900">{formatCurrency(quote.order_total || quote.price || 0)}</p>
              </li>
            ))}
            {!loading && quotes.length === 0 && <p className="text-sm text-slatePremium-500">No activity yet.</p>}
          </ul>
        </CardBody>
      </Card>
    </div>
  );
}
