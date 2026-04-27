export const formatCurrency = (value: number) =>
  new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(value || 0);

export const formatDate = (value?: string | null) => {
  if (!value) return 'N/A';
  return new Date(value).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
};

export const quoteStatus = (expiresAt?: string | null) => {
  if (!expiresAt) return 'Active';
  const exp = new Date(expiresAt).getTime();
  if (Number.isNaN(exp)) return 'Active';
  return exp < Date.now() ? 'Expired' : 'Active';
};
