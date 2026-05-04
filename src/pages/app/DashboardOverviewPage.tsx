import { Activity, FileText, PoundSterling, Timer } from 'lucide-react';
import { Bar, BarChart, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Card, CardBody, CardHeader } from '../../components/ui/Card';
import { formatCurrency } from '../../lib/format';
import type { Quote } from '../../types/app';

interface DashboardOverviewPageProps {
  quotes: Quote[];
  loading?: boolean;
}

const disciplineColors = ['#D4AF37', '#E0BE57', '#C89D2A', '#B98A1F', '#F0D98A', '#2D3E50'];

export function DashboardOverviewPage({ quotes, loading }: DashboardOverviewPageProps) {
  const totalValue = quotes.reduce((sum, quote) => sum + (quote.order_total || quote.price || 0), 0);
  const pendingQuotes = quotes.filter((q) => !q.quote_date).length;
  const expired = quotes.filter((q) => q.expires_at && new Date(q.expires_at).getTime() < Date.now()).length;

  const quoteTrend = [...quotes]
    .sort((a, b) => new Date(b.quote_date || b.created_at).getTime() - new Date(a.quote_date || a.created_at).getTime())
    .slice(0, 12)
    .reverse()
    .map((quote) => ({
      reference: quote.reference_number || quote.generated_part_number || quote.reference_name,
      value: Number(quote.order_total || quote.price || 0),
    }));

  const disciplineMap = quotes.reduce<Record<string, number>>((acc, quote) => {
    const key = quote.discipline || 'Unassigned';
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});

  const disciplineTotal = Object.values(disciplineMap).reduce((sum, count) => sum + count, 0);
  const byDiscipline = Object.entries(disciplineMap).map(([name, value]) => ({
    name,
    value,
    percentage: disciplineTotal > 0 ? Math.round((value / disciplineTotal) * 100) : 0,
  }));

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
            <h3 className="font-semibold text-navy-950">Quote trends (value by reference)</h3>
          </CardHeader>
          <CardBody className="h-[320px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={quoteTrend}>
                <XAxis dataKey="reference" stroke="#8fa2b8" interval={0} angle={-25} height={70} textAnchor="end" />
                <YAxis stroke="#8fa2b8" tickFormatter={(value) => `£${Number(value).toLocaleString('en-GB')}`} />
                <Tooltip formatter={(value: number) => formatCurrency(Number(value))} />
                <Bar dataKey="value" radius={[8, 8, 0, 0]} fill="#D4AF37" />
              </BarChart>
            </ResponsiveContainer>
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <h3 className="font-semibold text-navy-950">Disciplines distribution</h3>
          </CardHeader>
          <CardBody className="h-[320px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={byDiscipline} dataKey="value" nameKey="name" innerRadius={55} outerRadius={90}>
                  {byDiscipline.map((_, index) => (
                    <Cell key={index} fill={disciplineColors[index % disciplineColors.length]} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value: number, name: string, payload: unknown) => {
                    const percent =
                      payload && typeof payload === 'object' && 'payload' in payload
                        ? Number((payload as { payload?: { percentage?: number } }).payload?.percentage ?? 0)
                        : 0;
                    return [`${value} (${percent}%)`, name];
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="mt-2 space-y-1 text-xs text-slatePremium-600">
              {byDiscipline.map((item, index) => (
                <div key={item.name} className="flex items-center justify-between">
                  <span className="inline-flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: disciplineColors[index % disciplineColors.length] }} />
                    {item.name}
                  </span>
                  <span>{item.percentage}%</span>
                </div>
              ))}
            </div>
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
                  <p className="text-sm text-slatePremium-500">Quote date {new Date(quote.quote_date || quote.created_at).toLocaleDateString('en-GB')}</p>
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
