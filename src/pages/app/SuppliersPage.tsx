import { useMemo, useState } from 'react';
import { Building2, Mail, Phone, Search } from 'lucide-react';
import type { Quote } from '../../types/app';
import { Card, CardBody, CardHeader } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';
import { EmptyState } from '../../components/ui/EmptyState';
import { Modal } from '../../components/ui/Modal';
import { Button } from '../../components/ui/Button';

interface SuppliersPageProps {
  quotes: Quote[];
}

export function SuppliersPage({ quotes }: SuppliersPageProps) {
  const [query, setQuery] = useState('');
  const [selectedSupplier, setSelectedSupplier] = useState<string | null>(null);

  const suppliers = useMemo(() => {
    const grouped = new Map<string, Quote[]>();
    quotes.forEach((quote) => {
      const key = quote.supplier || 'Unknown Supplier';
      const list = grouped.get(key) || [];
      list.push(quote);
      grouped.set(key, list);
    });

    return Array.from(grouped.entries())
      .map(([name, supplierQuotes]) => ({
        name,
        count: supplierQuotes.length,
        lastContact: supplierQuotes[0]?.supplier_contact_name || supplierQuotes[0]?.contact_person || 'N/A',
        email: supplierQuotes[0]?.supplier_email || 'N/A',
        phone: supplierQuotes[0]?.supplier_phone || 'N/A',
        quotes: supplierQuotes,
      }))
      .filter((supplier) => supplier.name.toLowerCase().includes(query.toLowerCase()))
      .sort((a, b) => b.count - a.count);
  }, [quotes, query]);

  const active = suppliers.find((supplier) => supplier.name === selectedSupplier);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-navy-950">Supplier directory</h3>
          <Input
            className="max-w-sm"
            placeholder="Search suppliers"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </CardHeader>
        <CardBody>
          {suppliers.length === 0 ? (
            <EmptyState title="No suppliers found" description="Suppliers will appear once quotes are uploaded." icon={<Search className="text-navy-800" />} />
          ) : (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {suppliers.map((supplier) => (
                <button
                  key={supplier.name}
                  onClick={() => setSelectedSupplier(supplier.name)}
                  className="rounded-2xl border border-slatePremium-200 bg-white p-5 text-left transition hover:-translate-y-0.5 hover:border-gold-500"
                >
                  <div className="mb-4 flex items-center justify-between">
                    <div className="rounded-xl bg-navy-950/5 p-2 text-navy-800">
                      <Building2 size={18} />
                    </div>
                    <span className="rounded-full bg-slatePremium-100 px-2 py-1 text-xs font-medium">{supplier.count} quotes</span>
                  </div>
                  <h4 className="font-semibold text-slatePremium-900">{supplier.name}</h4>
                  <p className="mt-1 text-xs text-slatePremium-500">Contact: {supplier.lastContact}</p>
                </button>
              ))}
            </div>
          )}
        </CardBody>
      </Card>

      <Modal open={!!active} onClose={() => setSelectedSupplier(null)}>
        <div className="p-6">
          <h3 className="text-xl font-semibold text-navy-950">{active?.name}</h3>
          <div className="mt-4 space-y-2 text-sm text-slatePremium-700">
            <p className="flex items-center gap-2"><Mail size={15} /> {active?.email}</p>
            <p className="flex items-center gap-2"><Phone size={15} /> {active?.phone}</p>
            <p>Total quotes: {active?.count}</p>
          </div>
          <div className="mt-5 max-h-56 space-y-2 overflow-auto">
            {active?.quotes.map((quote) => (
              <div key={quote.id} className="rounded-xl border border-slatePremium-200 p-3 text-sm">
                <p className="font-medium">{quote.reference_name}</p>
                <p className="text-xs text-slatePremium-500">{quote.generated_part_number}</p>
              </div>
            ))}
          </div>
          <div className="mt-5 text-right">
            <Button variant="outline" onClick={() => setSelectedSupplier(null)}>
              Close
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
