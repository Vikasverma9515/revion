// Everything under /lab reads live data, so it is rendered per request.
export const dynamic = 'force-dynamic';

export default function LabLayout({ children }: { children: React.ReactNode }) {
  return children;
}
