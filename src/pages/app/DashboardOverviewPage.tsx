import { Activity, FileText, PoundSterling } from 'lucide-react';
import { Bar, BarChart, Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Card, CardBody, CardHeader } from '../../components/ui/Card';
import { formatCurrency } from '../../lib/format';
import type { Quote } from '../../types/app';

interface DashboardOverviewPageProps {
  quotes: Quote[];
  loading?: boolean;
}

const DISCIPLINE_NEON_COLORS: Record<string, string> = {
  Electrical: '#00FF00',
  Mechanical: '#FF1493',
  Structural: '#00FFFF',
  Civil: '#FF6600',
  ICA: '#FFFF00',
  Unassigned: '#CCCCCC',
};

const FALLBACK_NEON_COLORS = ['#39FF14', '#FF10F0', '#00E5FF', '#FF5F1F', '#F5FF00'];
const DISCIPLINE_ORDER = ['Electrical', 'Mechanical', 'Structural', 'Civil', 'ICA', 'Unassigned'];

const getDisciplineColor = (discipline: string, index: number) =>
  DISCIPLINE_NEON_COLORS[discipline] || FALLBACK_NEON_COLORS[index % FALLBACK_NEON_COLORS.length];

export function DashboardOverviewPage({ quotes, loading }: DashboardOverviewPageProps) {
  const totalValue = quotes.reduce((sum, quote) => sum + (quote.order_total || quote.price || 0), 0);
  const expired = quotes.filter((q) => q.expires_at && new Date(q.expires_at).getTime() < Date.now()).length;

  const consolidatedByReference = quotes.reduce<Record<string, number>>((acc, quote) => {
    const reference =
      quote.reference_number?.trim() ||
      quote.generated_part_number?.trim() ||
      quote.reference_name?.trim() ||
      'Unknown';

    acc[reference] = (acc[reference] || 0) + Number(quote.order_total || quote.price || 0);
    return acc;
  }, {});

  const quoteTrend = Object.entries(consolidatedByReference)
    .map(([reference, value]) => ({ reference, value }))
    .sort((a, b) =>
      a.reference.localeCompare(b.reference, 'en-GB', {
        numeric: true,
        sensitivity: 'base',
      }),
    );

  const disciplineMap = quotes.reduce<Record<string, number>>((acc, quote) => {
    const key = quote.discipline || 'Unassigned';
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});

  const disciplineTotal = Object.values(disciplineMap).reduce((sum, count) => sum + count, 0);
  const byDiscipline = Object.entries(disciplineMap)
    .map(([name, value]) => ({
      name,
      value,
      percentage: disciplineTotal > 0 ? Math.round((value / disciplineTotal) * 100) : 0,
    }))
    .sort((a, b) => {
      const aIndex = DISCIPLINE_ORDER.indexOf(a.name);
      const bIndex = DISCIPLINE_ORDER.indexOf(b.name);
      const normalizedA = aIndex === -1 ? Number.MAX_SAFE_INTEGER : aIndex;
      const normalizedB = bIndex === -1 ? Number.MAX_SAFE_INTEGER : bIndex;
      return normalizedA - normalizedB;
    });

  const disciplinePercentages = new Map(byDiscipline.map((item) => [item.name, item.percentage]));

  const kpis = [
    { label: 'Total Quotes', value: quotes.length, icon: FileText },
    { label: 'Portfolio Total Value', value: formatCurrency(totalValue), icon: PoundSterling },
    { label: 'Expired Quotes', value: expired, icon: Activity },
  ];

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-3">
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
          <CardBody className="h-[350px] p-4">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart margin={{ top: 8, right: 16, bottom: 20, left: 16 }}>
                <Pie
                  data={byDiscipline}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="45%"
                  innerRadius={60}
                  outerRadius={100}
                >
                  {byDiscipline.map((item, index) => (
                    <Cell key={item.name} fill={getDisciplineColor(item.name, index)} />
                  ))}
                </Pie>
                <Legend
                  align="center"
                  verticalAlign="bottom"
                  iconType="circle"
                  height={44}
                  wrapperStyle={{ fontSize: '12px', lineHeight: '18px', paddingTop: '8px' }}
                  formatter={(value) => {
                    const label = String(value);
                    const percent = disciplinePercentages.get(label) ?? 0;
                    return `${label} ${percent}%`;
                  }}
                />
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
