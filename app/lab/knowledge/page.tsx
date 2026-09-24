import { Boundary } from '#/ui/boundary';
import { PageTitle } from '#/ui/stat';
import { Knowledge } from './knowledge';

export const metadata = { title: 'Knowledge base' };

export default function Page() {
  return (
    <Boundary label="Knowledge" animateRerendering={false} kind="solid" color="blue" className="flex flex-col gap-8">
      <PageTitle kicker="Eval Lab" title="Knowledge base">
        <p>
          Documents are split into overlapping chunks of about 900 characters. Each chunk is embedded locally with all-MiniLM-L6-v2 (384
          dimensions) and stored in libSQL with a cosine vector index. The agent searches this index for every question.
        </p>
      </PageTitle>
      <Knowledge />
    </Boundary>
  );
}
