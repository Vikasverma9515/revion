import { Boundary } from '#/ui/boundary';
import { Loading } from '#/ui/form';
import { Suspense } from 'react';
import { Chat } from './chat';

export const metadata = { title: 'Agent chat' };

export default function Page() {
  return (
    <Boundary label="Agent chat" animateRerendering={false} kind="solid" color="blue" className="flex flex-col gap-6">
      <Suspense fallback={<Loading />}>
        <Chat />
      </Suspense>
    </Boundary>
  );
}
