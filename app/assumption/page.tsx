import { Boundary } from '#/ui/boundary';
import { PageTitle } from '#/ui/stat';
import { KappaCalculator, ToyWorld } from './assumption';

export const metadata = { title: 'P1b Assumption and kappa' };

export default function Page() {
  return (
    <>
      <Boundary label="P1b · kappa" animateRerendering={false} kind="solid" className="flex flex-col gap-8">
        <PageTitle kicker="Problem 1 (b)" title="Cohen's kappa from 96% agreement">
          <p>
            Agreement alone does not identify kappa: chance agreement depends on how often each annotator says
            &ldquo;violation&rdquo;. Using the 6% majority-label rate for every annotator gives the headline number; the range shows
            how much it moves with that assumption.
          </p>
        </PageTitle>
        <KappaCalculator />
      </Boundary>
      <Boundary label="P1b · assumption" animateRerendering={false} kind="solid" className="flex flex-col gap-8">
        <PageTitle kicker="Problem 1 (b)" title="What does the corrected estimate actually track?">
          <p>
            The correction in (a) assumes the annotators&apos; majority label is the truth and that judge errors are independent of
            annotator errors. In this toy world some items are ambiguous, and on those items annotators (and possibly the judge) share
            one impression that need not match the truth.
          </p>
          <p>
            Watch the three columns: the Rogan-Gladen estimate follows the annotators&apos; rate, whatever that rate&apos;s relation to
            the truth. The gap to the truth can be positive or negative depending on the settings; nothing here fixes its sign.
          </p>
        </PageTitle>
        <ToyWorld />
      </Boundary>
    </>
  );
}
