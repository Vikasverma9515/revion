import { Boundary } from '#/ui/boundary';
import { PageTitle } from '#/ui/stat';
import Link from 'next/link';

export const metadata = { title: 'About' };

function H({ children }: { children: React.ReactNode }) {
  return <h2 className="text-base font-semibold text-gray-100">{children}</h2>;
}

function P({ children }: { children: React.ReactNode }) {
  return <p className="max-w-prose text-sm leading-relaxed text-gray-400">{children}</p>;
}

export default function Page() {
  return (
    <Boundary label="About" animateRerendering={false} kind="solid" className="flex flex-col gap-8">
      <PageTitle kicker="Notes" title="Method, assumptions and reasoning">
        <p>
          Everything on this site is a simulation of a stated toy world, not production data. The worlds are small on purpose, so each
          assumption can be read, changed and tested.
        </p>
      </PageTitle>

      <section className="flex flex-col gap-3">
        <H>How the site works</H>
        <P>
          The Python scripts in <code className="font-mono text-gray-300">reference/python/</code> are the source of truth. The
          TypeScript in <code className="font-mono text-gray-300">lib/sim/</code> is a line-by-line port. Both use the same seeded
          generator (mulberry32) and draw random numbers in the same order, so a given seed gives identical results in both languages.
          The unit tests check that parity against JSON produced by the Python scripts.
        </P>
        <P>
          Closed-form calculations run in your browser as you move a slider. Simulations run in Node.js route handlers and stream their
          progress with Server-Sent Events, so charts fill in live. Runs are capped at 20,000 replays and stop with a message before the
          60-second function limit.
        </P>
        <P>
          Binomial draws sum Bernoulli trials for n ≤ 1,000. Above that they use a normal approximation, rounded and clamped to [0, n],
          which is only used for the 2,000,000 production responses. Beta draws for Jeffreys intervals use Marsaglia-Tsang gamma
          variates.
        </P>
      </section>

      <section className="flex flex-col gap-3">
        <H>Problem 1: the guardrail number</H>
        <P>
          <strong className="text-gray-200">(a)</strong> A flag rate of 9% is not a violation rate: the judge misses some violations and
          flags some clean responses. Calibration gives its sensitivity (20/24) and specificity (352/376). Solving 9% = π·Se + (1 − π)(1 −
          Sp) gives π ≈ 3.4%. The delta-method interval is 0.2% to 6.6%. It is wide because the correction divides by J = Se + Sp − 1 ≈
          0.77. Specificity, estimated from 376 clean items, carries about 96% of the variance. The 2 million production flags carry almost
          none. <Link className="text-accent underline" href="/estimator">Explore →</Link>
        </P>
        <P>
          <strong className="text-gray-200">(b)</strong> Kappa needs the annotators&apos; marginal rates, which the problem does not give.
          Using the 6% majority rate for each gives 0.645, and 0.58 to 0.73 for 5% to 8%. The estimate in (a) treats the majority label as
          the truth and assumes the judge&apos;s errors are independent of the annotators&apos; errors. An LLM judge reads the same policy
          and can share the annotators&apos; impression of ambiguous cases. The toy world shows the consequence: Rogan-Gladen reproduces the
          annotators&apos; rate, whatever its relation to the truth. The gap to the truth can have either sign, so I do not claim one.{' '}
          <Link className="text-accent underline" href="/assumption">Explore →</Link>
        </P>
        <P>
          <strong className="text-gray-200">(c)</strong> Stratify by the judge&apos;s decision and allocate by Neyman: 184 flagged, 316
          unflagged. The expected half-width is about 1 point. Only about 2 violations are expected among the unflagged, with a 14% chance
          of none. At zero events Wald reports no uncertainty for that stratum, so I use a Jeffreys interval per stratum, combined with the
          known weights. <Link className="text-accent underline" href="/design">Explore →</Link>
        </P>
      </section>

      <section className="flex flex-col gap-3">
        <H>Problem 2: recall is up, users are unhappy</H>
        <P>
          <strong className="text-gray-200">(a)</strong> 240 of 3,000 against 330 of 3,000 gives z = 3.96. That is not sampling noise if
          ratings are independent. Clustering by user would need a design effect above about 4.1 to erase it. A significant change still
          does not show that the embedding swap caused it. <Link className="text-accent underline" href="/is-it-real">Explore →</Link>
        </P>
        <P>
          <strong className="text-gray-200">(c)</strong> Labels exist only for the old system&apos;s top 20. Relevant documents outside
          that pool are missing from every denominator, so both absolute recalls are too high. When the new system finds one of them, it is
          scored as a miss, so its gain is understated. The toy model makes this precise: per document, true gain ≈ (1 − f) × measured
          gain + f × c. <Link className="text-accent underline" href="/golden-set">Explore →</Link>
        </P>
      </section>

      <section className="flex flex-col gap-3">
        <H>Assumptions</H>
        <ul className="flex max-w-prose list-disc flex-col gap-1.5 pl-5 text-sm leading-relaxed text-gray-400">
          <li>The calibration sample and production traffic come from the same distribution (the judge&apos;s Se and Sp transfer).</li>
          <li>The majority label is treated as the truth in (a). Part (b) relaxes this.</li>
          <li>Kappa assumes both annotators share the 6% marginal rate.</li>
          <li>Replays hold the calibration class counts (24 / 376) fixed and treat the point estimates as the truth.</li>
          <li>In (c), the 500 new labels are exact, and the flag rate (9%) is known, so the stratum weights are known.</li>
          <li>The coverage simulation keeps the judge&apos;s Se and Sp fixed while the true prevalence varies.</li>
          <li>The z-test treats ratings as independent; the design effect is the only allowance for clustering.</li>
          <li>
            Golden-set model: 1 to 10 relevant documents per query. Documents are placed independently, with no top-10 slot limit, and
            queries with no judged relevant document are dropped.
          </li>
        </ul>
      </section>

      <section className="flex flex-col gap-3">
        <H>What the two LLMs got wrong</H>
        <P>
          I used two assistants and treated any disagreement as a cue to recompute in code. One reported input standard errors of 0.075
          (sensitivity) and 0.0117 (specificity). Recomputing gives 0.0761 and 0.0126; its inputs would give a total SE near 0.0151, not
          the 0.0162 it reported. The other&apos;s first simulation of correlated errors was meant to show correlation biasing the
          estimate. Its own table showed the estimate matching the annotators&apos; rate while both moved away from the truth. The P1b page
          reproduces that comparison.
        </P>
      </section>
    </Boundary>
  );
}
