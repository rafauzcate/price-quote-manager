import { useState, useEffect } from 'react';
import { X, Save, Plus, Trash2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { QuoteDiscipline } from '../types/app';

interface LineItem {
  id?: string;
  product_code: string;
  description: string;
  quantity: number;
  unit_price: number;
  discount_percent: number;
  net_price: number;
}

interface Quote {
  id: string;
  discipline?: QuoteDiscipline | null;
  supplier?: string;
  supplier_contact_name?: string;
  supplier_email?: string;
  supplier_phone?: string;
  quote_reference?: string;
  quote_date?: string | null;
  price?: number;
  order_total?: number;
  notes?: string | null;
  line_items?: LineItem[];
}

interface QuoteEditModalProps {
  quote: Quote | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: () => void;
}

const disciplineOptions: QuoteDiscipline[] = ['Electrical', 'Mechanical', 'Structural', 'Civil', 'ICA'];

export function QuoteEditModal({ quote, isOpen, onClose, onSave }: QuoteEditModalProps) {
  const [formData, setFormData] = useState({
    discipline: '' as QuoteDiscipline | '',
    supplier: '',
    supplier_contact_name: '',
    supplier_email: '',
    supplier_phone: '',
    quote_reference: '',
    quote_date: '',
    price: 0,
    order_total: 0,
    notes: '',
  });
  const [lineItems, setLineItems] = useState<LineItem[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (quote) {
      setFormData({
        discipline: quote.discipline || '',
        supplier: quote.supplier || '',
        supplier_contact_name: quote.supplier_contact_name || '',
        supplier_email: quote.supplier_email || '',
        supplier_phone: quote.supplier_phone || '',
        quote_reference: quote.quote_reference || '',
        quote_date: quote.quote_date ? quote.quote_date.slice(0, 10) : '',
        price: quote.price || 0,
        order_total: quote.order_total || 0,
        notes: quote.notes || '',
      });

      if (quote.line_items && quote.line_items.length > 0) {
        setLineItems(quote.line_items);
      } else {
        setLineItems([]);
      }
    }
  }, [quote]);

  if (!isOpen || !quote) return null;

  const addLineItem = () => {
    setLineItems([
      ...lineItems,
      {
        product_code: '',
        description: '',
        quantity: 1,
        unit_price: 0,
        discount_percent: 0,
        net_price: 0,
      },
    ]);
  };

  const removeLineItem = (index: number) => {
    setLineItems(lineItems.filter((_, i) => i !== index));
  };

  const updateLineItem = (index: number, field: keyof LineItem, value: string | number) => {
    const updated = [...lineItems];
    updated[index] = { ...updated[index], [field]: value };

    if (field === 'quantity' || field === 'unit_price' || field === 'discount_percent') {
      const item = updated[index];
      const subtotal = item.quantity * item.unit_price;
      const discount = subtotal * (item.discount_percent / 100);
      updated[index].net_price = subtotal - discount;
    }

    setLineItems(updated);
  };

  const handleSave = async () => {
    setIsSaving(true);
    setError(null);

    try {
      const { error: updateError } = await supabase
        .from('quotes')
        .update({
          discipline: formData.discipline || null,
          supplier: formData.supplier,
          supplier_contact_name: formData.supplier_contact_name,
          supplier_email: formData.supplier_email,
          supplier_phone: formData.supplier_phone,
          quote_reference: formData.quote_reference,
          quote_date: formData.quote_date || null,
          price: formData.price,
          order_total: formData.order_total,
          notes: formData.notes,
        })
        .eq('id', quote.id);

      if (updateError) throw updateError;

      const { error: deleteError } = await supabase
        .from('quote_line_items')
        .delete()
        .eq('quote_id', quote.id);

      if (deleteError) throw deleteError;

      if (lineItems.length > 0) {
        const lineItemsToInsert = lineItems.map((item) => ({
          quote_id: quote.id,
          product_code: item.product_code || '',
          description: item.description || '',
          quantity: item.quantity || 0,
          unit_price: item.unit_price || 0,
          discount_percent: item.discount_percent || 0,
          net_price: item.net_price || 0,
        }));

        const { error: insertError } = await supabase
          .from('quote_line_items')
          .insert(lineItemsToInsert);

        if (insertError) throw insertError;
      }

      onSave();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save changes');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <>
      <div
        className="fixed inset-0 z-50 bg-black bg-opacity-50"
        onClick={onClose}
      />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="max-h-[90vh] w-full max-w-5xl overflow-y-auto rounded-lg bg-white shadow-xl" onClick={(e) => e.stopPropagation()}>
          <div className="sticky top-0 z-10 flex items-center justify-between border-b border-gray-200 bg-white p-6">
            <h3 className="text-xl font-semibold text-gray-800">Edit Quote</h3>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600"
            >
              <X className="h-6 w-6" />
            </button>
          </div>

          <div className="space-y-6 p-6">
            {error && (
              <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                {error}
              </div>
            )}

            <div>
              <h4 className="mb-3 text-lg font-semibold text-gray-800">Quote Information</h4>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">Discipline</label>
                  <select
                    value={formData.discipline}
                    onChange={(e) => setFormData({ ...formData, discipline: e.target.value as QuoteDiscipline | '' })}
                    className="w-full rounded-lg border border-gray-300 p-2 focus:border-transparent focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Select discipline</option>
                    {disciplineOptions.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">
                    Supplier Name
                  </label>
                  <input
                    type="text"
                    value={formData.supplier}
                    onChange={(e) => setFormData({ ...formData, supplier: e.target.value })}
                    className="w-full rounded-lg border border-gray-300 p-2 focus:border-transparent focus:ring-2 focus:ring-blue-500"
                    placeholder="Enter supplier name"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">
                    Contact Name
                  </label>
                  <input
                    type="text"
                    value={formData.supplier_contact_name}
                    onChange={(e) => setFormData({ ...formData, supplier_contact_name: e.target.value })}
                    className="w-full rounded-lg border border-gray-300 p-2 focus:border-transparent focus:ring-2 focus:ring-blue-500"
                    placeholder="Enter contact name"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">
                    Email
                  </label>
                  <input
                    type="email"
                    value={formData.supplier_email}
                    onChange={(e) => setFormData({ ...formData, supplier_email: e.target.value })}
                    className="w-full rounded-lg border border-gray-300 p-2 focus:border-transparent focus:ring-2 focus:ring-blue-500"
                    placeholder="Enter email"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">
                    Phone
                  </label>
                  <input
                    type="text"
                    value={formData.supplier_phone}
                    onChange={(e) => setFormData({ ...formData, supplier_phone: e.target.value })}
                    className="w-full rounded-lg border border-gray-300 p-2 focus:border-transparent focus:ring-2 focus:ring-blue-500"
                    placeholder="Enter phone"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">
                    Quote Reference
                  </label>
                  <input
                    type="text"
                    value={formData.quote_reference}
                    onChange={(e) => setFormData({ ...formData, quote_reference: e.target.value })}
                    className="w-full rounded-lg border border-gray-300 p-2 focus:border-transparent focus:ring-2 focus:ring-blue-500"
                    placeholder="Enter quote reference"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">
                    Quote Date
                  </label>
                  <input
                    type="date"
                    value={formData.quote_date}
                    onChange={(e) => setFormData({ ...formData, quote_date: e.target.value })}
                    className="w-full rounded-lg border border-gray-300 p-2 focus:border-transparent focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">
                    Unit Price
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.price}
                    onChange={(e) => setFormData({ ...formData, price: parseFloat(e.target.value) || 0 })}
                    className="w-full rounded-lg border border-gray-300 p-2 focus:border-transparent focus:ring-2 focus:ring-blue-500"
                    placeholder="0.00"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">
                    Order Total
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.order_total}
                    onChange={(e) => setFormData({ ...formData, order_total: parseFloat(e.target.value) || 0 })}
                    className="w-full rounded-lg border border-gray-300 p-2 focus:border-transparent focus:ring-2 focus:ring-blue-500"
                    placeholder="0.00"
                  />
                </div>
              </div>
            </div>

            <div>
              <div className="mb-3 flex items-center justify-between">
                <h4 className="text-lg font-semibold text-gray-800">Line Items</h4>
                <button
                  onClick={addLineItem}
                  className="flex items-center gap-2 rounded-lg bg-green-600 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-green-700"
                >
                  <Plus className="h-4 w-4" />
                  Add Line Item
                </button>
              </div>

              {lineItems.length === 0 ? (
                <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 text-center text-sm text-gray-600">
                  No line items. Click "Add Line Item" to add details about individual items in this quote.
                </div>
              ) : (
                <div className="space-y-4">
                  {lineItems.map((item, index) => (
                    <div key={index} className="rounded-lg border border-gray-200 bg-gray-50 p-4">
                      <div className="mb-3 flex items-start justify-between">
                        <h5 className="text-sm font-semibold text-gray-700">Item {index + 1}</h5>
                        <button
                          onClick={() => removeLineItem(index)}
                          className="rounded p-1 transition-colors hover:bg-red-100"
                          title="Remove item"
                        >
                          <Trash2 className="h-4 w-4 text-red-600" />
                        </button>
                      </div>
                      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                        <div className="md:col-span-1">
                          <label className="mb-1 block text-xs font-medium text-gray-600">Product Code</label>
                          <input
                            type="text"
                            value={item.product_code}
                            onChange={(e) => updateLineItem(index, 'product_code', e.target.value)}
                            className="w-full rounded-lg border border-gray-300 p-2 text-sm focus:border-transparent focus:ring-2 focus:ring-blue-500"
                            placeholder="e.g., PART-001"
                          />
                        </div>
                        <div className="md:col-span-2">
                          <label className="mb-1 block text-xs font-medium text-gray-600">Description</label>
                          <input
                            type="text"
                            value={item.description}
                            onChange={(e) => updateLineItem(index, 'description', e.target.value)}
                            className="w-full rounded-lg border border-gray-300 p-2 text-sm focus:border-transparent focus:ring-2 focus:ring-blue-500"
                            placeholder="Item description"
                          />
                        </div>
                        <div>
                          <label className="mb-1 block text-xs font-medium text-gray-600">Quantity</label>
                          <input
                            type="number"
                            step="1"
                            value={item.quantity}
                            onChange={(e) => updateLineItem(index, 'quantity', parseFloat(e.target.value) || 0)}
                            className="w-full rounded-lg border border-gray-300 p-2 text-sm focus:border-transparent focus:ring-2 focus:ring-blue-500"
                            placeholder="1"
                          />
                        </div>
                        <div>
                          <label className="mb-1 block text-xs font-medium text-gray-600">Unit Price</label>
                          <input
                            type="number"
                            step="0.01"
                            value={item.unit_price}
                            onChange={(e) => updateLineItem(index, 'unit_price', parseFloat(e.target.value) || 0)}
                            className="w-full rounded-lg border border-gray-300 p-2 text-sm focus:border-transparent focus:ring-2 focus:ring-blue-500"
                            placeholder="0.00"
                          />
                        </div>
                        <div>
                          <label className="mb-1 block text-xs font-medium text-gray-600">Discount %</label>
                          <input
                            type="number"
                            step="0.01"
                            value={item.discount_percent}
                            onChange={(e) => updateLineItem(index, 'discount_percent', parseFloat(e.target.value) || 0)}
                            className="w-full rounded-lg border border-gray-300 p-2 text-sm focus:border-transparent focus:ring-2 focus:ring-blue-500"
                            placeholder="0"
                          />
                        </div>
                        <div>
                          <label className="mb-1 block text-xs font-medium text-gray-600">Net Price</label>
                          <input
                            type="number"
                            step="0.01"
                            value={item.net_price}
                            readOnly
                            className="w-full rounded-lg border border-gray-300 bg-gray-100 p-2 text-sm text-gray-700"
                            placeholder="0.00"
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Notes</label>
              <textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                className="w-full resize-none rounded-lg border border-gray-300 p-3 focus:border-transparent focus:ring-2 focus:ring-blue-500"
                rows={4}
                placeholder="Add any additional notes or information about this quote"
              />
            </div>
          </div>

          <div className="sticky bottom-0 flex items-center justify-end gap-3 border-t border-gray-200 bg-gray-50 p-6">
            <button
              onClick={onClose}
              className="rounded-lg px-4 py-2 text-gray-700 transition-colors hover:bg-gray-100 hover:text-gray-900"
              disabled={isSaving}
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="flex items-center gap-2 rounded-lg bg-blue-600 px-6 py-2 font-medium text-white transition-colors hover:bg-blue-700 disabled:bg-blue-400"
            >
              {isSaving ? (
                <>Saving...</>
              ) : (
                <>
                  <Save className="h-4 w-4" />
                  Save Changes
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
