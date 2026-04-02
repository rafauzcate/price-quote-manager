interface LineItem {
  id: string;
  product_code: string;
  description: string;
  quantity: number;
  unit_price: number;
  discount_percent: number;
  net_price: number;
}

interface Quote {
  id: string;
  reference_name: string;
  reference_number: string;
  generated_part_number: string;
  supplier: string;
  part_description: string;
  price: number;
  created_at: string;
  lead_time: string;
  contact_person: string;
  quote_reference?: string;
  quote_date?: string;
  total_net_amount?: number;
  total_vat_amount?: number;
  order_total?: number;
  supplier_contact_name?: string;
  supplier_email?: string;
  supplier_phone?: string;
  line_items?: LineItem[];
  notes?: string;
}

interface PrintOptions {
  quotes: Quote[];
  userName: string;
  userEmail: string;
  userCompany?: string;
}

const formatPrice = (price: number) =>
  new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(price);

const formatDate = (dateString: string) =>
  new Date(dateString).toLocaleDateString('en-GB', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });

const formatDateTime = (date: Date) =>
  date.toLocaleString('en-GB', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });

export function printQuotes({ quotes, userName, userEmail, userCompany }: PrintOptions) {
  const now = new Date();
  const timestamp = formatDateTime(now);

  const totalValue = quotes.reduce((sum, q) => sum + (q.order_total || q.price), 0);

  const quoteRows = quotes
    .map((quote) => {
      const lineItemsHtml =
        quote.line_items && quote.line_items.length > 0
          ? `
        <div class="line-items">
          <table class="line-items-table">
            <thead>
              <tr>
                <th>Product Code</th>
                <th>Description</th>
                <th class="text-right">Qty</th>
                <th class="text-right">Unit Price</th>
                <th class="text-right">Discount</th>
                <th class="text-right">Net Price</th>
              </tr>
            </thead>
            <tbody>
              ${quote.line_items
                .map(
                  (item) => `
                <tr>
                  <td>${item.product_code || '—'}</td>
                  <td>${item.description}</td>
                  <td class="text-right">${item.quantity}</td>
                  <td class="text-right">${formatPrice(item.unit_price)}</td>
                  <td class="text-right">${item.discount_percent}%</td>
                  <td class="text-right font-medium">${formatPrice(item.net_price)}</td>
                </tr>
              `
                )
                .join('')}
            </tbody>
          </table>
          ${
            quote.total_net_amount !== undefined
              ? `
            <div class="totals-row">
              <span>Net Amount: <strong>${formatPrice(quote.total_net_amount)}</strong></span>
              ${quote.total_vat_amount ? `<span>VAT: <strong>${formatPrice(quote.total_vat_amount)}</strong></span>` : ''}
              <span>Total: <strong class="total-amount">${formatPrice(quote.order_total || 0)}</strong></span>
            </div>
          `
              : ''
          }
        </div>
      `
          : '';

      return `
      <div class="quote-card">
        <div class="quote-header">
          <div class="quote-header-grid">
            <div class="field">
              <span class="label">Reference Name</span>
              <span class="value">${quote.reference_name}</span>
            </div>
            <div class="field">
              <span class="label">Part Number</span>
              <span class="value blue">${quote.generated_part_number}</span>
            </div>
            <div class="field">
              <span class="label">Supplier</span>
              <span class="value">${quote.supplier}</span>
            </div>
            <div class="field">
              <span class="label">Quote Ref</span>
              <span class="value">${quote.quote_reference || '—'}</span>
            </div>
            <div class="field">
              <span class="label">Contact</span>
              <span class="value">${quote.supplier_contact_name || quote.contact_person || '—'}</span>
            </div>
            <div class="field">
              <span class="label">Email</span>
              <span class="value">${quote.supplier_email || '—'}</span>
            </div>
            <div class="field">
              <span class="label">Phone</span>
              <span class="value">${quote.supplier_phone || '—'}</span>
            </div>
            <div class="field">
              <span class="label">Quote Date</span>
              <span class="value">${quote.quote_date ? formatDate(quote.quote_date) : '—'}</span>
            </div>
            <div class="field">
              <span class="label">Total</span>
              <span class="value bold">${formatPrice(quote.order_total || quote.price)}</span>
            </div>
          </div>
          ${quote.notes ? `<div class="notes"><span class="label">Notes:</span> ${quote.notes}</div>` : ''}
        </div>
        ${lineItemsHtml}
      </div>
    `;
    })
    .join('');

  const html = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8" />
      <title>VantagePM - Quote Export</title>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }

        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
          font-size: 11px;
          color: #1a1a2e;
          background: white;
          padding: 24px;
        }

        /* Header */
        .print-header {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          border-bottom: 2px solid #003366;
          padding-bottom: 16px;
          margin-bottom: 20px;
        }

        .logo-area {
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .logo-text {
          font-size: 22px;
          font-weight: 700;
          line-height: 1;
        }

        .logo-vantage { color: #003366; }
        .logo-pm { color: #FF8C00; }

        .header-meta {
          text-align: right;
          line-height: 1.6;
        }

        .header-meta .report-title {
          font-size: 14px;
          font-weight: 700;
          color: #003366;
          margin-bottom: 4px;
        }

        .header-meta .meta-line {
          color: #555;
          font-size: 10.5px;
        }

        .header-meta .meta-label {
          font-weight: 600;
          color: #333;
        }

        /* Summary bar */
        .summary-bar {
          display: flex;
          gap: 16px;
          background: #f4f7fb;
          border: 1px solid #d1dce8;
          border-radius: 6px;
          padding: 10px 16px;
          margin-bottom: 20px;
        }

        .summary-item {
          display: flex;
          flex-direction: column;
          gap: 2px;
        }

        .summary-item .s-label {
          font-size: 9.5px;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          color: #666;
          font-weight: 600;
        }

        .summary-item .s-value {
          font-size: 15px;
          font-weight: 700;
          color: #003366;
        }

        .summary-divider {
          width: 1px;
          background: #c8d6e5;
          margin: 2px 0;
        }

        /* Quote cards */
        .quote-card {
          border: 1px solid #d1dce8;
          border-radius: 6px;
          margin-bottom: 14px;
          overflow: hidden;
          page-break-inside: avoid;
        }

        .quote-header {
          background: #f8fafc;
          padding: 10px 12px;
          border-bottom: 1px solid #e2e8f0;
        }

        .quote-header-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 6px 16px;
        }

        .field {
          display: flex;
          flex-direction: column;
          gap: 1px;
        }

        .label {
          font-size: 9px;
          text-transform: uppercase;
          letter-spacing: 0.06em;
          color: #888;
          font-weight: 600;
        }

        .value {
          font-size: 11px;
          color: #1a1a2e;
        }

        .value.blue { color: #1d4ed8; font-weight: 600; }
        .value.bold { font-weight: 700; }

        .notes {
          margin-top: 8px;
          padding-top: 8px;
          border-top: 1px dashed #e2e8f0;
          font-size: 10px;
          color: #555;
        }

        /* Line items */
        .line-items {
          padding: 10px 12px;
          background: white;
        }

        .line-items-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 10px;
        }

        .line-items-table th {
          text-align: left;
          font-size: 9px;
          text-transform: uppercase;
          letter-spacing: 0.04em;
          color: #666;
          font-weight: 600;
          padding: 4px 6px;
          border-bottom: 1px solid #e2e8f0;
        }

        .line-items-table th.text-right,
        .line-items-table td.text-right { text-align: right; }

        .line-items-table td {
          padding: 4px 6px;
          color: #333;
          border-bottom: 1px solid #f0f0f0;
        }

        .line-items-table td.font-medium { font-weight: 600; }

        .totals-row {
          display: flex;
          justify-content: flex-end;
          gap: 20px;
          padding-top: 8px;
          margin-top: 6px;
          border-top: 1px solid #e2e8f0;
          font-size: 10.5px;
          color: #555;
        }

        .total-amount {
          color: #003366;
          font-weight: 700;
        }

        /* Footer */
        .print-footer {
          margin-top: 24px;
          padding-top: 12px;
          border-top: 1px solid #d1dce8;
          display: flex;
          justify-content: space-between;
          font-size: 9.5px;
          color: #888;
        }

        @media print {
          body { padding: 16px; }
          @page { margin: 12mm; size: A4; }
        }
      </style>
    </head>
    <body>
      <div class="print-header">
        <div class="logo-area">
          <svg width="36" height="36" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M20 4 L17 18 L20 16 L23 18 Z" fill="#FF8C00" stroke="#FF8C00" stroke-width="0.5" stroke-linejoin="miter"/>
            <path d="M36 20 L22 17 L24 20 L22 23 Z" fill="#333333"/>
            <path d="M20 36 L17 22 L20 24 L23 22 Z" fill="#333333"/>
            <path d="M4 20 L18 17 L16 20 L18 23 Z" fill="#333333"/>
            <circle cx="20" cy="20" r="3" fill="white" stroke="#333333" stroke-width="1"/>
          </svg>
          <div class="logo-text">
            <span class="logo-vantage">Vantage</span><span class="logo-pm">PM</span>
          </div>
        </div>
        <div class="header-meta">
          <div class="report-title">Quote Export Report</div>
          <div class="meta-line"><span class="meta-label">Exported by:</span> ${userName || userEmail}${userCompany ? ` &bull; ${userCompany}` : ''}</div>
          <div class="meta-line"><span class="meta-label">Email:</span> ${userEmail}</div>
          <div class="meta-line"><span class="meta-label">Date &amp; Time:</span> ${timestamp}</div>
        </div>
      </div>

      <div class="summary-bar">
        <div class="summary-item">
          <span class="s-label">Total Quotes</span>
          <span class="s-value">${quotes.length}</span>
        </div>
        <div class="summary-divider"></div>
        <div class="summary-item">
          <span class="s-label">Total Value</span>
          <span class="s-value">${formatPrice(totalValue)}</span>
        </div>
        <div class="summary-divider"></div>
        <div class="summary-item">
          <span class="s-label">Unique Suppliers</span>
          <span class="s-value">${new Set(quotes.map((q) => q.supplier)).size}</span>
        </div>
      </div>

      ${quoteRows}

      <div class="print-footer">
        <span>Generated by VantagePM &mdash; Procurement Intelligence</span>
        <span>${timestamp}</span>
      </div>
    </body>
    </html>
  `;

  const printWindow = window.open('', '_blank', 'width=900,height=700');
  if (!printWindow) return;

  printWindow.document.write(html);
  printWindow.document.close();
  printWindow.focus();

  printWindow.onload = () => {
    printWindow.print();
  };
}
