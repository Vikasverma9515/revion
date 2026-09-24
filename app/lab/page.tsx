import { Boundary } from '#/ui/boundary';
import { PageTitle } from '#/ui/stat';
import { Dashboard } from './dashboard';

export const metadata = { title: 'Eval Lab' };

export default function Page() {
  return (
    <Boundary label="Eval Lab" animateRerendering={false} kind="solid" color="blue" className="flex flex-col gap-8">
      <PageTitle kicker="Live system" title="Agent, LLM judges and human annotators">
        <p>
          An agent on Groq answers questions, and every question and answer is saved in a SQLite database that runs in your browser. Gemini judges score golden sets or imported sessions against your rubric. Human annotators label the same
          items, so you can see how far to trust the judges.
        </p>
      </PageTitle>
      <Dashboard />
    </Boundary>
  );
}
