import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { isPublicRoutePath } from './routeGuards';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

let client: SupabaseClient | null = null;

function shouldBlockDataApiCall(operation: string): boolean {
  if (typeof window === 'undefined') return false;
  const route = window.location.pathname;
  const isPublic = isPublicRoutePath(route);
  const shouldBlock = isPublic;

  const stack = new Error().stack;
  console.log('[SupabaseGuard] API call attempt', { operation, route, isPublic, stack });

  if (shouldBlock) {
    console.warn('[SupabaseGuard] Blocked non-auth Supabase API call on public route.', { operation, route, stack });
  }

  return shouldBlock;
}

function createBlockedThenable(defaultData: any) {
  const response = {
    data: defaultData,
    error: null,
    count: Array.isArray(defaultData) ? defaultData.length : null,
    status: 200,
    statusText: 'Suppressed on public route',
  };

  const chainProxy: any = new Proxy(
    {
      then: (resolve: (value: any) => any) => Promise.resolve(resolve(response)),
      catch: () => Promise.resolve(response),
      finally: (cb: () => void) => {
        cb?.();
        return Promise.resolve(response);
      },
    },
    {
      get(target, prop) {
        if (prop in target) {
          return (target as any)[prop];
        }

        return (..._args: any[]) => chainProxy;
      },
    },
  );

  return chainProxy;
}

export function getSupabaseClient(): SupabaseClient {
  if (!client) {
    console.log('[Supabase] Initializing client');
    client = createClient(supabaseUrl, supabaseAnonKey);
  }

  return client;
}

const supabaseProxy = new Proxy(
  {},
  {
    get(_target, prop) {
      const raw = getSupabaseClient() as any;

      if (prop === 'from') {
        return (table: string) => {
          if (shouldBlockDataApiCall(`from:${table}`)) {
            return createBlockedThenable([]);
          }
          return raw.from(table);
        };
      }

      if (prop === 'rpc') {
        return (fnName: string, ...rest: any[]) => {
          if (shouldBlockDataApiCall(`rpc:${fnName}`)) {
            return Promise.resolve({ data: [], error: null });
          }
          return raw.rpc(fnName, ...rest);
        };
      }

      if (prop === 'functions') {
        return new Proxy(raw.functions, {
          get(functionsTarget, fnProp) {
            if (fnProp === 'invoke') {
              return (functionName: string, options?: any) => {
                if (shouldBlockDataApiCall(`function:${functionName}`)) {
                  return Promise.resolve({ data: null, error: null });
                }
                return (functionsTarget as any).invoke(functionName, options);
              };
            }
            return (functionsTarget as any)[fnProp];
          },
        });
      }

      return raw[prop as keyof typeof raw];
    },
  },
) as SupabaseClient;

export const supabase = supabaseProxy;
