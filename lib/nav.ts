export type NavItem = { href: string; name: string; description: string };

export const NAV: { name: string; items: NavItem[] }[] = [
  {
    name: 'Start',
    items: [{ href: '/', name: 'Overview', description: 'The answers, and a panel that re-checks every number.' }],
  },
  {
    name: 'Problem 1 · Guardrail number',
    items: [
      { href: '/estimator', name: 'P1a Estimator', description: 'Rogan-Gladen correction with a delta-method interval.' },
      { href: '/assumption', name: 'P1b Assumption & kappa', description: 'What the estimate tracks when judge and annotators share blind spots.' },
      { href: '/design', name: 'P1c Sampling design', description: 'Stratified 500 labels, Neyman allocation, interval coverage.' },
    ],
  },
  {
    name: 'Problem 2 · Recall up, users unhappy',
    items: [
      { href: '/is-it-real', name: 'P2a Is it real?', description: 'Two-proportion z-test and the design effect that breaks it.' },
      { href: '/golden-set', name: 'P2c Golden-set bias', description: 'What labelling only the old top 20 hides.' },
    ],
  },
  {
    name: 'Eval Lab · live system',
    items: [
      { href: '/lab', name: 'Dashboard', description: 'Setup status, activity and recent benchmark runs.' },
      { href: '/lab/chat', name: 'Agent chat', description: 'Ask the agent; every question and answer is stored.' },
      { href: '/lab/sessions', name: 'Sessions', description: 'Stored conversations with tool calls, latency and tokens.' },
      { href: '/lab/golden', name: 'Golden sets', description: 'Curated questions with edited reference answers.' },
      { href: '/lab/agents', name: 'Agents & rubrics', description: 'Agent settings and judging rules.' },
      { href: '/lab/studio', name: 'Benchmark studio', description: 'Run LLM judges over golden sets or sessions; stored reports.' },
      { href: '/lab/annotate', name: 'Annotate', description: 'Human labels, and agreement with the LLM judges.' },
    ],
  },
  {
    name: 'Notes',
    items: [{ href: '/about', name: 'About', description: 'Method, assumptions and reasoning in plain language.' }],
  },
];
