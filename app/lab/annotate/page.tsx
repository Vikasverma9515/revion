import { Boundary } from '#/ui/boundary';
import { Loading } from '#/ui/form';
import { PageTitle } from '#/ui/stat';
import { Suspense } from 'react';
import { Annotate } from './annotate';

export const metadata = { title: 'Annotate' };

export default function Page() {
  return (
    <Boundary label="Annotate" animateRerendering={false} kind="solid" color="blue" className="flex flex-col gap-8">
      <PageTitle kicker="Eval Lab" title="Human annotation">
        <p>
          Label the same items the LLM judges scored. Judge scores stay hidden until you have labelled an item, so they cannot anchor you.
          With several annotators, each item&apos;s human label is the majority. The run report then compares humans with judges.
        </p>
      </PageTitle>
      <Suspense fallback={<Loading />}>
        <Annotate />
      </Suspense>
    </Boundary>
  );
}
