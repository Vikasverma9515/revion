'use client';
// Renders model output (Markdown with tables). Raw HTML is not rendered.
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

const SYMBOLS: Record<string, string> = {
  approx: '≈', times: '×', cdot: '·', pm: '±', le: '≤', leq: '≤', ge: '≥', geq: '≥', neq: '≠', to: '→', infty: '∞',
  alpha: 'α', beta: 'β', kappa: 'κ', pi: 'π', sigma: 'σ', mu: 'μ', hat: '', quad: ' ', qquad: '  ', ',': ' ', ';': ' ', '!': '',
  sqrt: '√', sum: 'Σ', Delta: 'Δ', delta: 'δ', ldots: '…', dots: '…', left: '', right: '', big: '', Big: '',
  partial: '∂', lambda: 'λ', theta: 'θ', rho: 'ρ', tau: 'τ', gamma: 'γ', epsilon: 'ε', mid: '|', text: '', displaystyle: '',
};

/** Models sometimes answer in LaTeX; turn the common bits into readable plain text. */
export function delatex(md: string) {
  let s = md.replace(/\\\[([\s\S]*?)\\\]/g, (_, m) => `\n\n${m.trim()}\n\n`).replace(/\\\(([\s\S]*?)\\\)/g, '$1');
  // Environments such as \begin{aligned} … \end{aligned}: drop the wrappers,
  // turn \\ into line breaks and remove the & alignment marks.
  s = s
    .replace(/\\(?:begin|end)\{[a-zA-Z*]+\}/g, '')
    .replace(/\\\\(\[[^\]]*\])?/g, '  \n')
    .replace(/&\s*(=|≈|\\approx|<|>|\\le|\\ge)/g, '$1');
  // Unwrap \text{…} first so nested fractions such as \frac{\text{TP}}{…} can match.
  s = s.replace(/\\(?:text|mathrm|mathbf|operatorname|boxed)\{([^{}]*)\}/g, '$1');
  for (let i = 0; i < 3; i++) s = s.replace(/\\(?:d|t)?frac\{([^{}]*)\}\{([^{}]*)\}/g, '($1)/($2)');
  s = s
    .replace(/\\sqrt\{([^{}]*)\}/g, '√($1)')
    .replace(/\\([A-Za-z]+|[,;!])/g, (m, name) => SYMBOLS[name] ?? m)
    .replace(/\^\{([^{}]*)\}/g, '^$1')
    .replace(/_\{([^{}]*)\}/g, '_$1');
  return s;
}

export function Markdown({ children }: { children: string }) {
  return (
    <div className="prose prose-sm max-w-none text-gray-100 [&_code]:rounded [&_code]:bg-gray-800 [&_code]:px-1 [&_code]:font-mono [&_code]:text-[0.85em] [&_h1]:text-base [&_h2]:text-base [&_h3]:text-sm [&_h1,&_h2,&_h3,&_strong]:text-gray-100 [&_li]:my-0.5 [&_p]:my-2 [&_table]:my-2 [&_table]:block [&_table]:overflow-x-auto [&_td]:border [&_td]:border-gray-700 [&_td]:px-2 [&_td]:py-1 [&_th]:border [&_th]:border-gray-700 [&_th]:px-2 [&_th]:py-1 [&_th]:text-gray-200 text-gray-200">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{delatex(children)}</ReactMarkdown>
    </div>
  );
}
