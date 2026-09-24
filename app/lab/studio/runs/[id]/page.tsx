import { Boundary } from '#/ui/boundary';
import { Report } from './report';

export const metadata = { title: 'Benchmark report' };

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <Boundary label="Report" animateRerendering={false} kind="solid" color="blue" className="flex flex-col gap-8">
      <Report id={Number(id)} />
    </Boundary>
  );
}
