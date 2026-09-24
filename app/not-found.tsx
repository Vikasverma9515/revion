import { Boundary } from '#/ui/boundary';
import Link from 'next/link';

export default function NotFound() {
  return (
    <Boundary label="Not found" color="pink" animateRerendering={false}>
      <div className="flex flex-col gap-4">
        <h2 className="text-lg font-bold text-gray-100">Page not found</h2>
        <Link href="/" className="text-sm text-accent underline">
          Back to the overview
        </Link>
      </div>
    </Boundary>
  );
}
