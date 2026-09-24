import { Boundary } from '#/ui/boundary';
import { PageTitle } from '#/ui/stat';
import { ZTest } from './ztest';

export const metadata = { title: 'P2a Is it real?' };

export default function Page() {
  return (
    <Boundary label="P2a" animateRerendering={false} kind="solid" className="flex flex-col gap-8">
      <PageTitle kicker="Problem 2 (a)" title="Is 8% → 11% thumbs-down a real change?">
        <p>
          A two-proportion z-test says the jump is far outside sampling noise, if every rating were independent. Ratings cluster by
          user and by session, which inflates the variance by a design effect. The slider shows how much clustering it takes to erase
          the result.
        </p>
      </PageTitle>
      <ZTest />
    </Boundary>
  );
}
