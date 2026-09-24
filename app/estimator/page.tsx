import { Boundary } from '#/ui/boundary';
import { PageTitle } from '#/ui/stat';
import { Estimator } from './estimator';

export const metadata = { title: 'P1a Estimator' };

export default function Page() {
  return (
    <Boundary label="P1a" animateRerendering={false} kind="solid" className="flex flex-col gap-8">
      <PageTitle kicker="Problem 1 (a)" title="From a 9% flag rate to a true violation rate">
        <p>
          The judge&apos;s flag rate mixes true positives with false positives. Calibration against the annotators&apos; majority
          label gives the judge&apos;s sensitivity and specificity, and the Rogan-Gladen formula removes the misclassification. Change
          any count below and every number updates.
        </p>
      </PageTitle>
      <Estimator />
    </Boundary>
  );
}
