import { useState, useEffect } from 'react';
import { X, Save, Plus, Trash2 } from 'lucide-react';
import { supabase } from '../lib/supabase';

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
  supplier: string;
  supplier_contact_name: string;
  supplier_email: string;
  supplier_phone: string;
  quote_reference: string;
  quote_date: string | null;
  price: number;
  order_total: number;
  notes: string | null;
  line_items?: LineItem[];
}

interface QuoteEditModalProps {
  quote: Quote | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: () => void;
}

export function QuoteEditModal({ quote, isOpen, onClose, onSave }: QuoteEditModalProps) {
  const [formData, setFormData] = useState({
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
        supplier: quote.supplier || '',
        supplier_contact_name: quote.supplier_contact_name || '',
        supplier_email: quote.supplier_email || '',
        supplier_phone: quote.supplier_phone || '',
        quote_reference: quote.quote_reference || '',
        quote_date: quote.quote_date || '',
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

    // Auto-calculate net_price when quantity, unit_price, or discount_percent changes
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
      // Update the main quote
      const { error: updateError } = await supabase
        .from('quotes')
        .update({
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

      // Delete existing line items
      const { error: deleteError } = await supabase
        .from('quote_line_items')
        .delete()
        .eq('quote_id', quote.id);

      if (deleteError) throw deleteError;

      // Insert new line items if any
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
        className="fixed inset-0 bg-black bg-opacity-50 z-50"
        onClick={onClose}
      />
      <div className="fixed inset-0 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-lg shadow-xl max-w-5xl w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
          <div className="flex items-center justify-between p-6 border-b border-gray-200 sticky top-0 bg-white z-10">
            <h3 className="text-xl font-semibold text-gray-800">Edit Quote</h3>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600"
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          <div className="p-6 space-y-6">
            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                {error}
              </div>
            )}

            {/* Quote Header Information */}
            <div>
              <h4 className="text-lg font-semibold text-gray-800 mb-3">Quote Information</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Supplier Name
                  </label>
                  <input
                    type="text"
                    value={formData.supplier}
                    onChange={(e) => setFormData({ ...formData, supplier: e.target.value })}
                    className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Enter supplier name"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Contact Name
                  </label>
                  <input
                    type="text"
                    value={formData.supplier_contact_name}
                    onChange={(e) => setFormData({ ...formData, supplier_contact_name: e.target.value })}
                    className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Enter contact name"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Email
                  </label>
                  <input
                    type="email"
                    value={formData.supplier_email}
                    onChange={(e) => setFormData({ ...formData, supplier_email: e.target.value })}
                    className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Enter email"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Phone
                  </label>
                  <input
                    type="text"
                    value={formData.supplier_phone}
                    onChange={(e) => setFormData({ ...formData, supplier_phone: e.target.value })}
                    className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Enter phone"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Quote Reference
                  </label>
                  <input
                    type="text"
                    value={formData.quote_reference}
                    onChange={(e) => setFormData({ ...formData, quote_reference: e.target.value })}
                    className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Enter quote reference"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Quote Date
                  </label>
                  <input
                    type="date"
                    value={formData.quote_date}
                    onChange={(e) => setFormData({ ...formData, quote_date: e.target.value })}
                    className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Unit Price
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.price}
                    onChange={(e) => setFormData({ ...formData, price: parseFloat(e.target.value) || 0 })}
                    className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="0.00"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Order Total
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.order_total}
                    onChange={(e) => setFormData({ ...formData, order_total: parseFloat(e.target.value) || 0 })}
                    className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="0.00"
                  />
                </div>
              </div>
            </div>

            {/* Line Items Section */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-lg font-semibold text-gray-800">Line Items</h4>
                <button
                  onClick={addLineItem}
                  className="flex items-center gap-2 px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded-lg transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  Add Line Item
                </button>
              </div>

              {lineItems.length === 0 ? (
                <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg text-center text-gray-600 text-sm">
                  No line items. Click "Add Line Item" to add details about individual items in this quote.
                </div>
              ) : (
                <div className="space-y-4">
                  {lineItems.map((item, index) => (
                    <div key={index} className="p-4 bg-gray-50 border border-gray-200 rounded-lg">
                      <div className="flex items-start justify-between mb-3">
                        <h5 className="text-sm font-semibold text-gray-700">Item {index + 1}</h5>
                        <button
                          onClick={() => removeLineItem(index)}
                          className="p-1 hover:bg-red-100 rounded transition-colors"
                          title="Remove item"
                        >
                          <Trash2 className="w-4 h-4 text-red-600" />
                        </button>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        <div className="md:col-span-1">
                          <label className="block text-xs font-medium text-gray-600 mb-1">
                            Product Code
                          </label>
                          <input
                            type="text"
                            value={item.product_code}
                            onChange={(e) => updateLineItem(index, 'product_code', e.target.value)}
                            className="w-full p-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            placeholder="e.g., PART-001"
                          />
                        </div>
                        <div className="md:col-span-2">
                          <label className="block text-xs font-medium text-gray-600 mb-1">
                            Description
                          </label>
                          <input
                            type="text"
                            value={item.description}
                            onChange={(e) => updateLineItem(index, 'description', e.target.value)}
                            className="w-full p-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            placeholder="Item description"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">
                            Quantity
                          </label>
                          <input
                            type="number"
                            step="1"
                            value={item.quantity}
                            onChange={(e) => updateLineItem(index, 'quantity', parseFloat(e.target.value) || 0)}
                            className="w-full p-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            placeholder="1"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">
                            Unit Price
                          </label>
                          <input
                            type="number"
                            step="0.01"
                            value={item.unit_price}
                            onChange={(e) => updateLineItem(index, 'unit_price', parseFloat(e.target.value) || 0)}
                            className="w-full p-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            placeholder="0.00"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">
                            Discount %
                          </label>
                          <input
                            type="number"
                            step="0.01"
                            value={item.discount_percent}
                            onChange={(e) => updateLineItem(index, 'discount_percent', parseFloat(e.target.value) || 0)}
                            className="w-full p-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            placeholder="0"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">
                            Net Price
                          </label>
                          <input
                            type="number"
                            step="0.01"
                            value={item.net_price}
                            readOnly
                            className="w-full p-2 text-sm border border-gray-300 rounded-lg bg-gray-100 text-gray-700"
                            placeholder="0.00"
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Notes Section */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Notes
              </label>
              <textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                rows={4}
                placeholder="Add any additional notes or information about this quote"
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-200 bg-gray-50 sticky bottom-0">
            <button
              onClick={onClose}
              className="px-4 py-2 text-gray-700 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
              disabled={isSaving}
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="flex items-center gap-2 px-6 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-medium rounded-lg transition-colors"
            >
              {isSaving ? (
                <>Saving...</>
              ) : (
                <>
                  <Save className="w-4 h-4" />
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
