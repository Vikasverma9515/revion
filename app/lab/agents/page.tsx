import { Boundary } from '#/ui/boundary';
import { PageTitle } from '#/ui/stat';
import { AgentsEditor, RubricsEditor } from './editors';

export const metadata = { title: 'Agents and rubrics' };

export default function Page() {
  return (
    <>
      <Boundary label="Agents" animateRerendering={false} kind="solid" color="blue" className="flex flex-col gap-8">
        <PageTitle kicker="Eval Lab" title="Agents">
          <p>An agent is a Groq model, a system prompt and a temperature. Benchmarks record which agent produced each answer.</p>
        </PageTitle>
        <AgentsEditor />
      </Boundary>
      <Boundary label="Rubrics" animateRerendering={false} kind="solid" color="blue" className="flex flex-col gap-8">
        <PageTitle kicker="Eval Lab" title="Rubrics: your rules for the judges">
          <p>
            Each criterion is scored 1 to 5 by every judge, with a reason. An item passes when the mean score reaches the threshold and it
            breaks none of the hard rules. The code computes pass or fail from the scores; the judge model never decides it directly.
          </p>
        </PageTitle>
        <RubricsEditor />
      </Boundary>
    </>
  );
}
