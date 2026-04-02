export const ADMIN_EMAIL = 'rafael.uzcategui@gmail.com';
export const TRIAL_DAYS = 30;

export interface TrialStatus {
  isActive: boolean;
  daysRemaining: number;
  isAdmin: boolean;
}

export function calculateTrialStatus(
  userEmail: string,
  signupDate: string | null
): TrialStatus {
  if (userEmail === ADMIN_EMAIL) {
    return {
      isActive: true,
      daysRemaining: Infinity,
      isAdmin: true,
    };
  }

  if (!signupDate) {
    return {
      isActive: true,
      daysRemaining: TRIAL_DAYS,
      isAdmin: false,
    };
  }

  const signup = new Date(signupDate);
  const now = new Date();
  const daysSinceSignup = Math.floor(
    (now.getTime() - signup.getTime()) / (1000 * 60 * 60 * 24)
  );

  const daysRemaining = TRIAL_DAYS - daysSinceSignup;

  return {
    isActive: daysRemaining > 0,
    daysRemaining: Math.max(0, daysRemaining),
    isAdmin: false,
  };
}
