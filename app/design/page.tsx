import { Boundary } from '#/ui/boundary';
import { PageTitle } from '#/ui/stat';
import { DesignExplorer } from './design';

export const metadata = { title: 'P1c Sampling design' };

export default function Page() {
  return (
    <Boundary label="P1c" animateRerendering={false} kind="solid" className="flex flex-col gap-8">
      <PageTitle kicker="Problem 1 (c)" title="Spending 500 exact labels">
        <p>
          Stratify by the judge&apos;s decision. The flagged stratum is 9% of traffic but has a high violation rate; the unflagged
          stratum is 91% of traffic with a rate below 1%. Neyman allocation splits the labels in proportion to each stratum&apos;s
          weight times its standard deviation.
        </p>
      </PageTitle>
      <DesignExplorer />
    </Boundary>
  );
}
