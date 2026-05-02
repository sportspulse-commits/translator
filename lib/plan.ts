import { getRedis } from './redis';

export type Plan = 'free' | 'pro' | 'family';

export interface UserPlan {
  plan: Plan;
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
}

const MONTHLY_LIMITS: Record<Plan, number> = {
  free: 10,
  pro: 100,
  family: 99999,
};

const FEATURE_PLANS: Record<'scan' | 'refine', Plan[]> = {
  scan: ['pro', 'family'],
  refine: ['pro', 'family'],
};

export async function getUserPlan(userId: string): Promise<UserPlan> {
  try {
    const stored = await getRedis().get<UserPlan>(`plan:${userId}`);
    return stored ?? { plan: 'free' };
  } catch {
    return { plan: 'free' };
  }
}

export async function setUserPlan(userId: string, data: UserPlan): Promise<void> {
  await getRedis().set(`plan:${userId}`, data);
}

export function monthlyLimit(plan: Plan): number {
  return MONTHLY_LIMITS[plan];
}

export function canUseFeature(plan: Plan, feature: 'scan' | 'refine'): boolean {
  return FEATURE_PLANS[feature].includes(plan);
}

export async function getQueryCount(userId: string): Promise<number> {
  const month = new Date().toISOString().slice(0, 7);
  try {
    const n = await getRedis().get<number>(`ql:${userId}:${month}`);
    return n ?? 0;
  } catch {
    return 0;
  }
}

export async function incrementQueryCount(userId: string): Promise<number> {
  const month = new Date().toISOString().slice(0, 7);
  const key = `ql:${userId}:${month}`;
  try {
    const count = await getRedis().incr(key);
    if (count === 1) await getRedis().expire(key, 60 * 60 * 24 * 35);
    return count;
  } catch {
    return 0;
  }
}
