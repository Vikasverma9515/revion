import { Boundary } from '#/ui/boundary';
import { Suspense } from 'react';
import { LoginForm } from './form';

export const metadata = { title: 'Lab access' };

export default function Page() {
  return (
    <Boundary label="Lab access" animateRerendering={false} kind="solid" color="blue" className="flex max-w-md flex-col gap-4">
      <h1 className="text-xl font-semibold text-gray-100">Enter the lab access token</h1>
      <p className="text-sm text-gray-400">The Eval Lab calls paid LLM APIs, so it is protected. The simulations elsewhere on the site stay public.</p>
      <Suspense>
        <LoginForm />
      </Suspense>
    </Boundary>
  );
}
