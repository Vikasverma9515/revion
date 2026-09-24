import { Boundary } from '#/ui/boundary';
import { PageTitle } from '#/ui/stat';
import { GoldenSet } from './golden';

export const metadata = { title: 'P2c Golden-set bias' };

export default function Page() {
  return (
    <Boundary label="P2c" animateRerendering={false} kind="solid" className="flex flex-col gap-8">
      <PageTitle kicker="Problem 2 (c)" title="What a golden set built from the old top 20 hides">
        <p>
          Annotators judged only the documents the old system ranked in its top 20. Relevant documents outside that pool are invisible:
          they are missing from every recall denominator, and when the new system retrieves one it is scored as a miss.
        </p>
        <p>
          In this toy model each relevant document is outside the old top 20 with probability f. The new system retrieves a document in
          its top 10 with probability k, m or c, depending on where the old system ranked it.
        </p>
      </PageTitle>
      <GoldenSet />
    </Boundary>
  );
}
