export const PUBLIC_ROUTE_PREFIXES = ['/auth'];
export const PUBLIC_ROUTES = new Set(['/', '/pricing', '/login', '/signup', '/reset-password']);

export function isPublicRoutePath(pathname: string): boolean {
  if (!pathname) return true;
  if (PUBLIC_ROUTES.has(pathname)) return true;
  return PUBLIC_ROUTE_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

export function isPublicRoute(): boolean {
  if (typeof window === 'undefined') return false;
  return isPublicRoutePath(window.location.pathname);
}

export function canCallDataApiOnCurrentRoute(pathname?: string): boolean {
  const currentPath = pathname ?? (typeof window !== 'undefined' ? window.location.pathname : '');
  return !isPublicRoutePath(currentPath);
}
