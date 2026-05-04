export type PlanType = 'individual' | 'org_5' | 'org_10' | 'org_50';

export interface PlanConfig {
  id: PlanType;
  name: string;
  priceGbp: number;
  seats: number;
  description: string;
  features: string[];
}

export const PLAN_CONFIGS: PlanConfig[] = [
  {
    id: 'individual',
    name: 'Individual',
    priceGbp: 20,
    seats: 1,
    description: 'Perfect for solo procurement specialists',
    features: ['1 user account', 'Unlimited quote parsing', 'AI-assisted extraction', 'Basic support'],
  },
  {
    id: 'org_5',
    name: 'Organization 5',
    priceGbp: 50,
    seats: 5,
    description: 'For small teams with shared workflows',
    features: ['Up to 5 users', 'Shared organization workspace', 'Team invite management', 'Priority support'],
  },
  {
    id: 'org_10',
    name: 'Organization 10',
    priceGbp: 75,
    seats: 10,
    description: 'Growing procurement and commercial teams',
    features: ['Up to 10 users', 'Advanced team access controls', 'Usage transparency', 'Priority support'],
  },
  {
    id: 'org_50',
    name: 'Organization 50',
    priceGbp: 100,
    seats: 50,
    description: 'Enterprise collaboration at scale',
    features: ['Up to 50 users', 'Large-team administration', 'Shared quota across org', 'Priority support'],
  },
];
