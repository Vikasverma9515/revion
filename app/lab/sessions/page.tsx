import { Boundary } from '#/ui/boundary';
import { PageTitle } from '#/ui/stat';
import { Sessions } from './sessions';

export const metadata = { title: 'Sessions' };

export default function Page() {
  return (
    <Boundary label="Sessions" animateRerendering={false} kind="solid" color="blue" className="flex flex-col gap-8">
      <PageTitle kicker="Eval Lab" title="Stored sessions">
        <p>
          Every conversation with every agent, with the sources each answer used, its tool calls, latency and tokens. In the Benchmark
          studio, sessions can be imported as a source; their stored answers are judged as they were given.
        </p>
      </PageTitle>
      <Sessions />
    </Boundary>
  );
}
