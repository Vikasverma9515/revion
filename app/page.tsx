import { Boundary } from '#/ui/boundary';
import { PageTitle } from '#/ui/stat';
import { VerifyPanel } from '#/app/verify-panel';
import Link from 'next/link';

const ANSWERS = [
  { href: '/estimator', value: '3.4%', label: 'True violation rate', detail: 'Rogan-Gladen correction of the 9% flag rate.' },
  { href: '/estimator', value: '0.2% – 6.6%', label: '95% confidence interval', detail: 'Delta method; specificity carries ~96% of the variance.' },
  { href: '/assumption', value: '0.645', label: "Cohen's kappa", detail: '96% agreement at 6% prevalence; 0.58–0.73 for 5–8%.' },
  { href: '/design', value: '184 / 316', label: 'Neyman allocation of 500 labels', detail: 'Flagged / unflagged strata.' },
  { href: '/design', value: '±1.0 point', label: 'Expected half-width', detail: '≈ 2 violations expected among unflagged; 14% chance of none.' },
  { href: '/is-it-real', value: 'z = 3.96', label: 'Thumbs-down 8% → 11%', detail: 'p ≈ 7e-5; lost at a design effect of about 4.1.' },
];

export default function Page() {
  return (
    <>
      <Boundary label="Overview" animateRerendering={false} kind="solid" className="flex flex-col gap-8">
        <PageTitle kicker="Two-problem evaluation screen" title="The answers, and the simulations behind them">
          <p>
            Each card below is one number from my written answers. Open a card to change the inputs and re-run the simulation that
            produced it. Every run is seeded, so the same seed gives the same result here and in the Python reference scripts.
          </p>
        </PageTitle>
        <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {ANSWERS.map((a) => (
            <li key={a.label}>
              <Link
                href={a.href}
                className="group flex h-full flex-col gap-1 rounded-lg bg-gray-900 px-5 py-4 hover:bg-gray-800 focus-visible:outline-2 focus-visible:outline-accent"
              >
                <span className="text-xs font-medium text-gray-400">{a.label}</span>
                <span className="font-mono text-2xl font-semibold text-gray-100 tabular-nums group-hover:text-white">{a.value}</span>
                <span className="text-[13px] text-gray-500 group-hover:text-gray-300">{a.detail}</span>
                <span className="mt-auto pt-2 text-xs font-medium text-accent">Explore →</span>
              </Link>
            </li>
          ))}
        </ul>
      </Boundary>
      <Boundary label="Verify" animateRerendering={false} kind="solid" color="blue">
        <VerifyPanel />
      </Boundary>
    </>
  );
}
