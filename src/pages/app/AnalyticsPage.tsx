import { Download, FileSpreadsheet } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis, Cell } from 'recharts';
import type { Quote } from '../../types/app';
import { Card, CardBody, CardHeader } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';

interface AnalyticsPageProps {
  quotes: Quote[];
}

const pieColors = ['#D4AF37', '#1a2332', '#2D3E50'];

export function AnalyticsPage({ quotes }: AnalyticsPageProps) {
  const trend = Object.values(
    quotes.reduce<Record<string, { month: string; volume: number; avgValue: number; total: number }>>((acc, quote) => {
      const month = new Date(quote.created_at).toLocaleDateString('en-GB', { month: 'short', year: '2-digit' });
      const amount = quote.order_total || quote.price || 0;
      acc[month] = acc[month] || { month, volume: 0, avgValue: 0, total: 0 };
      acc[month].volume += 1;
      acc[month].total += amount;
      acc[month].avgValue = Number((acc[month].total / acc[month].volume).toFixed(2));
      return acc;
    }, {}),
  );

  const bySupplier = Object.entries(
    quotes.reduce<Record<string, number>>((acc, quote) => {
      acc[quote.supplier] = (acc[quote.supplier] || 0) + 1;
      return acc;
    }, {}),
  )
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 8);

  const status = [
    { name: 'Active', value: quotes.filter((q) => !q.expires_at || new Date(q.expires_at).getTime() > Date.now()).length },
    { name: 'Expired', value: quotes.filter((q) => q.expires_at && new Date(q.expires_at).getTime() < Date.now()).length },
    { name: 'Pending', value: quotes.filter((q) => !q.quote_date).length },
  ];

  const conversionRate = quotes.length ? Math.round(((quotes.length - status[1].value) / quotes.length) * 100) : 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-2xl font-bold text-navy-950">Analytics dashboard</h2>
        <div className="flex gap-2">
          <Button variant="outline" leftIcon={<Download size={14} />}>Export PDF</Button>
          <Button variant="outline" leftIcon={<FileSpreadsheet size={14} />}>Export Excel</Button>
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader><h3 className="font-semibold">Quote volume trends</h3></CardHeader>
          <CardBody className="h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trend}>
                <CartesianGrid strokeDasharray="3 3" stroke="#d6dee8" />
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip />
                <Line type="monotone" dataKey="volume" stroke="#D4AF37" strokeWidth={2.5} />
              </LineChart>
            </ResponsiveContainer>
          </CardBody>
        </Card>

        <Card>
          <CardHeader><h3 className="font-semibold">Quote status distribution</h3></CardHeader>
          <CardBody className="h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={status} dataKey="value" nameKey="name" innerRadius={60} outerRadius={90}>
                  {status.map((_, idx) => (
                    <Cell key={idx} fill={pieColors[idx % pieColors.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardBody>
        </Card>

        <Card>
          <CardHeader><h3 className="font-semibold">Top suppliers</h3></CardHeader>
          <CardBody className="h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={bySupplier}>
                <CartesianGrid strokeDasharray="3 3" stroke="#d6dee8" />
                <XAxis dataKey="name" tick={false} />
                <YAxis />
                <Tooltip />
                <Bar dataKey="value" fill="#1a2332" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardBody>
        </Card>

        <Card>
          <CardHeader><h3 className="font-semibold">Value + conversion</h3></CardHeader>
          <CardBody>
            <div className="space-y-4 text-sm">
              <div className="rounded-xl bg-slatePremium-50 p-4">
                <p className="text-slatePremium-500">Average quote value</p>
                <p className="text-2xl font-bold text-navy-950">
                  £{quotes.length ? (quotes.reduce((acc, q) => acc + (q.order_total || q.price || 0), 0) / quotes.length).toFixed(2) : '0.00'}
                </p>
              </div>
              <div className="rounded-xl bg-slatePremium-50 p-4">
                <p className="text-slatePremium-500">Conversion health</p>
                <p className="text-2xl font-bold text-navy-950">{conversionRate}%</p>
              </div>
            </div>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
