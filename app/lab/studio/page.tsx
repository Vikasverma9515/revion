import { Boundary } from '#/ui/boundary';
import { PageTitle } from '#/ui/stat';
import { Studio } from './studio';

export const metadata = { title: 'Benchmark studio' };

export default function Page() {
  return (
    <Boundary label="Benchmark studio" animateRerendering={false} kind="solid" color="blue" className="flex flex-col gap-8">
      <PageTitle kicker="Eval Lab" title="Benchmark studio">
        <p>
          Pick an agent, a source and a rubric, and choose one or more Gemini judges. With a golden set, the agent answers every question
          fresh. With imported sessions, the stored answers are judged exactly as users saw them, using a golden reference when one was
          saved from that answer.
        </p>
        <p>
          Runs are processed one item at a time and stored as they go, so a run can be paused and resumes where it stopped.
        </p>
      </PageTitle>
      <Studio />
    </Boundary>
  );
}
