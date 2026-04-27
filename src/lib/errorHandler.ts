interface EndpointFailureState {
  consecutiveFailures: number;
  blockedUntil: number;
  lastError: string | null;
}

export interface EndpointBlockStatus {
  blocked: boolean;
  retryAfterMs: number;
  message: string | null;
}

const FAILURE_THRESHOLD = 3;
const BLOCK_DURATION_MS = 30_000;
const endpointState = new Map<string, EndpointFailureState>();

function getState(endpoint: string): EndpointFailureState {
  const existing = endpointState.get(endpoint);
  if (existing) return existing;

  const initial: EndpointFailureState = {
    consecutiveFailures: 0,
    blockedUntil: 0,
    lastError: null,
  };
  endpointState.set(endpoint, initial);
  return initial;
}

export function getEndpointBlockStatus(endpoint: string): EndpointBlockStatus {
  const state = getState(endpoint);
  const now = Date.now();
  const blocked = state.blockedUntil > now;

  return {
    blocked,
    retryAfterMs: blocked ? state.blockedUntil - now : 0,
    message: blocked ? 'Unable to connect. Please refresh the page.' : null,
  };
}

export function recordEndpointSuccess(endpoint: string): void {
  endpointState.set(endpoint, {
    consecutiveFailures: 0,
    blockedUntil: 0,
    lastError: null,
  });
}

export function recordEndpointFailure(endpoint: string, errorMessage: string): EndpointBlockStatus {
  const state = getState(endpoint);
  const consecutiveFailures = state.consecutiveFailures + 1;
  const blockedUntil = consecutiveFailures >= FAILURE_THRESHOLD ? Date.now() + BLOCK_DURATION_MS : 0;

  endpointState.set(endpoint, {
    consecutiveFailures,
    blockedUntil,
    lastError: errorMessage,
  });

  return getEndpointBlockStatus(endpoint);
}

export function resetEndpointFailures(endpoint: string): void {
  endpointState.delete(endpoint);
}

export function getEndpointFailureSnapshot(endpoint: string): {
  consecutiveFailures: number;
  blockedUntil: number;
  lastError: string | null;
} {
  const state = getState(endpoint);
  return {
    consecutiveFailures: state.consecutiveFailures,
    blockedUntil: state.blockedUntil,
    lastError: state.lastError,
  };
}
