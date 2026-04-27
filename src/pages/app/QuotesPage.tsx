import { useMemo, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { Download, Eye, FileText, Filter, Loader2, Plus, Trash2, UploadCloud } from 'lucide-react';

import { formatCurrency, formatDate, quoteStatus } from '../../lib/format';
import type { Quote } from '../../types/app';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Card, CardBody, CardHeader } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';
import { EmptyState } from '../../components/ui/EmptyState';

interface QuotesPageProps {
  quotes: Quote[];
  loading?: boolean;
  onDeleteQuote: (quoteId: string) => Promise<void>;
  onCreateQuote: (data: { fileContent: string; referenceName: string; referenceNumber: string; file?: File; fileName?: string }) => Promise<void>;
  userName?: string;
  userEmail?: string;
  userCompany?: string;
}

export function QuotesPage({ quotes, loading, onDeleteQuote, onCreateQuote, userName, userEmail, userCompany }: QuotesPageProps) {
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<'created_at' | 'supplier' | 'value'>('created_at');
  const [selected, setSelected] = useState<string[]>([]);
  const [activeQuote, setActiveQuote] = useState<Quote | null>(null);
  const [creating, setCreating] = useState(false);
  const [referenceName, setReferenceName] = useState('');
  const [referenceNumber, setReferenceNumber] = useState('');
  const [fileContent, setFileContent] = useState('');
  const [fileObj, setFileObj] = useState<File | undefined>();

  const filtered = useMemo(() => {
    const lower = search.toLowerCase();
    const rows = quotes.filter((q) => {
      const text = `${q.reference_name} ${q.reference_number} ${q.supplier} ${q.part_description} ${q.notes || ''}`.toLowerCase();
      return text.includes(lower);
    });

    return rows.sort((a, b) => {
      if (sortBy === 'supplier') return a.supplier.localeCompare(b.supplier);
      if (sortBy === 'value') return (b.order_total || b.price || 0) - (a.order_total || a.price || 0);
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });
  }, [quotes, search, sortBy]);

  const paginated = filtered.slice(0, 12);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    multiple: false,
    onDropAccepted: async (accepted) => {
      const file = accepted[0];
      if (!file) return;
      const { parseFile } = await import('../../lib/fileParser');
      const parsed = await parseFile(file);
      setFileContent(parsed);
      setFileObj(file);
    },
  });

  const handleCreate = async () => {
    if (!referenceName || !referenceNumber || !fileContent) return;
    setCreating(true);
    try {
      await onCreateQuote({
        referenceName,
        referenceNumber,
        fileContent,
        file: fileObj,
        fileName: fileObj?.name,
      });
      setReferenceName('');
      setReferenceNumber('');
      setFileContent('');
      setFileObj(undefined);
    } finally {
      setCreating(false);
    }
  };

  const handleExport = async () => {
    const selectedQuotes = quotes.filter((quote) => selected.includes(quote.id));
    if (!selectedQuotes.length) return;
    const { printQuotes } = await import('../../lib/printQuotes');
    printQuotes({
      quotes: selectedQuotes.map((quote) => ({ ...quote, notes: quote.notes ?? undefined })),
      userName: userName || '',
      userEmail: userEmail || '',
      userCompany,
    });
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <h3 className="text-lg font-semibold text-navy-950">Create quote</h3>
        </CardHeader>
        <CardBody>
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="space-y-4">
              <div {...getRootProps()} className={`rounded-2xl border-2 border-dashed p-6 text-center transition ${isDragActive ? 'border-gold-500 bg-gold-500/5' : 'border-slatePremium-300 bg-slatePremium-50'}`}>
                <input {...getInputProps()} />
                <UploadCloud className="mx-auto mb-3 text-navy-700" />
                <p className="text-sm font-medium">Drag and drop quote files</p>
                <p className="text-xs text-slatePremium-500">PDF, Word, Excel or email attachments</p>
              </div>
              <textarea
                value={fileContent}
                onChange={(e) => setFileContent(e.target.value)}
                rows={6}
                className="w-full rounded-xl border border-slatePremium-300 px-3 py-2.5"
                placeholder="Paste quote text here or upload file above"
              />
            </div>
            <div className="space-y-3">
              <Input label="Reference Name" value={referenceName} onChange={(e) => setReferenceName(e.target.value)} />
              <Input label="Reference Number" value={referenceNumber} onChange={(e) => setReferenceNumber(e.target.value)} />
              <div className="rounded-xl border border-slatePremium-200 bg-slatePremium-50 p-3 text-xs text-slatePremium-600">AI parsing status: {fileContent ? 'Ready to parse' : 'Awaiting file input'}</div>
              <Button onClick={handleCreate} disabled={creating || !referenceName || !referenceNumber || !fileContent} leftIcon={creating ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}>
                {creating ? 'Processing...' : 'Create Quote'}
              </Button>
            </div>
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-lg font-semibold text-navy-950">Quote management</h3>
          <div className="flex gap-2">
            <Button variant="outline" leftIcon={<Filter size={14} />}>
              Filters
            </Button>
            <Button variant="outline" onClick={handleExport} leftIcon={<Download size={14} />} disabled={!selected.length}>
              Export ({selected.length})
            </Button>
          </div>
        </CardHeader>
        <CardBody>
          <div className="mb-4 flex flex-wrap gap-3">
            <Input className="max-w-md" placeholder="Search quotes, suppliers, references" value={search} onChange={(e) => setSearch(e.target.value)} />
            <select className="rounded-xl border border-slatePremium-300 bg-white px-3 py-2.5 text-sm" value={sortBy} onChange={(e) => setSortBy(e.target.value as typeof sortBy)}>
              <option value="created_at">Newest</option>
              <option value="supplier">Supplier</option>
              <option value="value">Value</option>
            </select>
          </div>

          {loading ? (
            <p className="text-sm text-slatePremium-500">Loading quotes...</p>
          ) : paginated.length === 0 ? (
            <EmptyState title="No quotes found" description="Upload your first quote to start comparing suppliers." icon={<FileText className="text-navy-800" />} />
          ) : (
            <div className="overflow-x-auto rounded-xl border border-slatePremium-200">
              <table className="min-w-full text-sm">
                <thead className="bg-slatePremium-50 text-left text-slatePremium-500">
                  <tr>
                    <th className="px-3 py-2"><input type="checkbox" checked={selected.length === paginated.length} onChange={(e) => setSelected(e.target.checked ? paginated.map((q) => q.id) : [])} /></th>
                    <th className="px-3 py-2">Reference</th>
                    <th className="px-3 py-2">Supplier</th>
                    <th className="px-3 py-2">Status</th>
                    <th className="px-3 py-2">Value</th>
                    <th className="px-3 py-2">Date</th>
                    <th className="px-3 py-2 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {paginated.map((quote) => (
                    <tr key={quote.id} className="border-t border-slatePremium-100 hover:bg-slatePremium-50" title={quote.part_description || 'Quote preview'}>
                      <td className="px-3 py-2"><input type="checkbox" checked={selected.includes(quote.id)} onChange={(e) => setSelected((prev) => (e.target.checked ? [...prev, quote.id] : prev.filter((id) => id !== quote.id)))} /></td>
                      <td className="px-3 py-2">
                        <p className="font-medium text-slatePremium-900">{quote.reference_name}</p>
                        <p className="text-xs text-slatePremium-500">{quote.generated_part_number}</p>
                      </td>
                      <td className="px-3 py-2">{quote.supplier}</td>
                      <td className="px-3 py-2">
                        <Badge variant={quoteStatus(quote.expires_at) === 'Expired' ? 'danger' : 'success'}>{quoteStatus(quote.expires_at)}</Badge>
                      </td>
                      <td className="px-3 py-2 font-semibold">{formatCurrency(quote.order_total || quote.price || 0)}</td>
                      <td className="px-3 py-2">{formatDate(quote.created_at)}</td>
                      <td className="px-3 py-2">
                        <div className="flex justify-end gap-1">
                          <button className="rounded p-1 hover:bg-slatePremium-200" onClick={() => setActiveQuote(quote)} aria-label="preview"><Eye size={15} /></button>
                          <button className="rounded p-1 hover:bg-red-100 text-red-600" onClick={() => onDeleteQuote(quote.id)} aria-label="delete"><Trash2 size={15} /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardBody>
      </Card>

      {activeQuote && (
        <Card>
          <CardHeader className="flex items-center justify-between">
            <h3 className="font-semibold text-navy-950">Quote detail preview</h3>
            <Button variant="ghost" onClick={() => setActiveQuote(null)}>
              Close
            </Button>
          </CardHeader>
          <CardBody className="grid gap-6 lg:grid-cols-2">
            <div className="space-y-2 text-sm text-slatePremium-700">
              <p><span className="font-semibold">Reference:</span> {activeQuote.reference_name}</p>
              <p><span className="font-semibold">Supplier:</span> {activeQuote.supplier}</p>
              <p><span className="font-semibold">Contact:</span> {activeQuote.supplier_contact_name || activeQuote.contact_person || 'N/A'}</p>
              <p><span className="font-semibold">Email:</span> {activeQuote.supplier_email || 'N/A'}</p>
              <p><span className="font-semibold">Phone:</span> {activeQuote.supplier_phone || 'N/A'}</p>
            </div>
            <div className="overflow-auto rounded-xl border border-slatePremium-200">
              <table className="min-w-full text-sm">
                <thead className="bg-slatePremium-50">
                  <tr>
                    <th className="px-3 py-2 text-left">Item</th>
                    <th className="px-3 py-2 text-right">Qty</th>
                    <th className="px-3 py-2 text-right">Net</th>
                  </tr>
                </thead>
                <tbody>
                  {(activeQuote.line_items || []).map((item) => (
                    <tr key={item.id} className="border-t border-slatePremium-100">
                      <td className="px-3 py-2">{item.description}</td>
                      <td className="px-3 py-2 text-right">{item.quantity}</td>
                      <td className="px-3 py-2 text-right">{formatCurrency(item.net_price)}</td>
                    </tr>
                  ))}
                  {(activeQuote.line_items || []).length === 0 && (
                    <tr>
                      <td className="px-3 py-4 text-slatePremium-500" colSpan={3}>No line items parsed for this quote.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </CardBody>
        </Card>
      )}
    </div>
  );
}
