const SUPERADMIN_EMAILS = new Set(['rafael.uzcategui@gmail.com', 'hello@vantageprojectsolution.co.uk']);
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
  if (SUPERADMIN_EMAILS.has(userEmail.trim().toLowerCase())) {
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
