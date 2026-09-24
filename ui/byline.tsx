import { Boundary } from '#/ui/boundary';

export default function Byline() {
  return (
    <Boundary kind="solid" animateRerendering={false}>
      <div className="flex flex-wrap gap-x-4 gap-y-2 text-sm font-medium text-gray-500">
        <span>Simulations of stated toy worlds, not production data.</span>
        <span className="text-gray-700" aria-hidden>
          /
        </span>
        <a className="transition-colors hover:text-gray-200" href="https://github.com/Vikasverma9515/revion" target="_blank" rel="noreferrer">
          Source code and Python reference
        </a>
      </div>
    </Boundary>
  );
}
