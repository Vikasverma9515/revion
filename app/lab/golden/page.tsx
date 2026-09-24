import { Boundary } from '#/ui/boundary';
import { PageTitle } from '#/ui/stat';
import { Golden } from './golden';

export const metadata = { title: 'Golden sets' };

export default function Page() {
  return (
    <Boundary label="Golden sets" animateRerendering={false} kind="solid" color="blue" className="flex flex-col gap-8">
      <PageTitle kicker="Eval Lab" title="Golden datasets">
        <p>
          Questions with reference answers you trust. Add them here, or from any chat answer with &ldquo;Save to golden set&rdquo;, after
          editing the answer into the one you want. In the Benchmark studio the agent answers each question fresh, and the judges compare
          its answer with the reference.
        </p>
      </PageTitle>
      <Golden />
    </Boundary>
  );
}
