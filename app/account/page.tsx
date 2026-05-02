import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { getUserPlan, getQueryCount, monthlyLimit } from '@/lib/plan';
import { AccountActions } from '@/components/AccountActions';

export default async function AccountPage({
  searchParams,
}: {
  searchParams: { upgraded?: string };
}) {
  const { userId } = await auth();
  if (!userId) redirect('/sign-in');

  const [planData, queriesUsed] = await Promise.all([
    getUserPlan(userId),
    getQueryCount(userId),
  ]);
  const limit = monthlyLimit(planData.plan);
  const justUpgraded = searchParams.upgraded === '1';
  const pct = planData.plan === 'family' ? 0 : Math.min(100, (queriesUsed / limit) * 100);

  return (
    <div className="tx-app">
      <header className="tx-header">
        <div className="tx-wordmark">
          Translator<span className="tx-wordmark-dot">.</span>
        </div>
        <a href="/" className="tx-header-link">← Back</a>
      </header>

      <div className="tx-scroll">
        <div className="tx-stage">

          {justUpgraded && (
            <div className="tx-account-success" role="status">
              You&apos;re on {planData.plan === 'family' ? 'Family' : 'Pro'}. Welcome!
            </div>
          )}

          <h1 className="tx-account-title">Your account</h1>

          <div className="tx-plan-card">
            <div className="tx-plan-badge tx-plan-badge-{planData.plan}">
              {planData.plan === 'free' && 'Free'}
              {planData.plan === 'pro' && 'Pro'}
              {planData.plan === 'family' && 'Family'}
            </div>

            <div className="tx-usage">
              <p className="tx-usage-label">
                {planData.plan === 'family'
                  ? 'Unlimited queries'
                  : `${queriesUsed} of ${limit} queries used this month`}
              </p>
              {planData.plan !== 'family' && (
                <div className="tx-usage-track">
                  <div className="tx-usage-fill" style={{ width: `${pct}%` }} />
                </div>
              )}
            </div>

            <ul className="tx-plan-features">
              <li>Q&amp;A in plain English</li>
              <li>Voice input</li>
              <li>Read aloud</li>
              <li>Share with family</li>
              {planData.plan !== 'free' && (
                <>
                  <li className="tx-plan-feature-pro">Scan documents</li>
                  <li className="tx-plan-feature-pro">Shorter / More detail</li>
                </>
              )}
            </ul>
          </div>

          <AccountActions plan={planData.plan} hasStripe={!!planData.stripeCustomerId} />

        </div>
      </div>
    </div>
  );
}
