/**
 * AGENTNAME — Pipeline Heuristic
 *
 * Chains multiple heuristic steps to produce an action plan.
 * Each step is a trained classifier or extractor.
 * The pipeline short-circuits on failure.
 *
 * Replace the example steps with your own pipeline stages.
 */

export interface PipelineStep {
  name: string;
  status: 'pass' | 'fail' | 'skip';
  result: unknown;
  timeMs: number;
}

export interface PipelineAction {
  type: string;      // 'fill', 'click', 'navigate', 'wait', 'done', 'error'
  target?: string;   // CSS selector
  value?: string;
  confidence: number;
}

export interface PipelineResult {
  steps: PipelineStep[];
  action: PipelineAction | null;
}

type StepFn = (input: string, prev: unknown) => { pass: boolean; result: unknown };

/**
 * Define your pipeline steps here.
 * Each step receives the original input and the previous step's result.
 * Return { pass: true/false, result: any }.
 * If pass is false, the pipeline short-circuits.
 */
const STEPS: { name: string; fn: StepFn }[] = [
  // Step 1: Classify — is this the right type of page?
  {
    name: 'classify',
    fn: (input) => {
      // Example: check if page has a form
      const hasForm = /<form[\s>]/i.test(input);
      return { pass: hasForm, result: { hasForm } };
    },
  },
  // Step 2: Extract — find relevant elements
  {
    name: 'extract',
    fn: (input) => {
      // Example: find all input fields
      const inputs = input.match(/<input[^>]*>/gi) || [];
      return { pass: inputs.length > 0, result: { inputCount: inputs.length } };
    },
  },
  // Step 3: Decide — what action to take
  {
    name: 'decide',
    fn: (_input, prev) => {
      // Example: if we found inputs, suggest filling the first one
      const data = prev as { inputCount: number };
      return {
        pass: data.inputCount > 0,
        result: { action: 'fill', target: 'input:first-of-type' },
      };
    },
  },
];

export function runPipeline(html: string): PipelineResult {
  const steps: PipelineStep[] = [];
  let prevResult: unknown = null;
  let failed = false;

  for (const step of STEPS) {
    if (failed) {
      steps.push({ name: step.name, status: 'skip', result: null, timeMs: 0 });
      continue;
    }

    const start = performance.now();
    try {
      const { pass, result } = step.fn(html, prevResult);
      const timeMs = performance.now() - start;
      steps.push({ name: step.name, status: pass ? 'pass' : 'fail', result, timeMs });
      prevResult = result;
      if (!pass) failed = true;
    } catch (e) {
      steps.push({
        name: step.name,
        status: 'fail',
        result: { error: e instanceof Error ? e.message : String(e) },
        timeMs: performance.now() - start,
      });
      failed = true;
    }
  }

  // Build action from the last successful step
  let action: PipelineAction | null = null;
  if (!failed && prevResult) {
    const data = prevResult as { action?: string; target?: string; value?: string };
    if (data.action) {
      action = {
        type: data.action,
        target: data.target,
        value: data.value,
        confidence: 0.8,
      };
    }
  }

  return { steps, action };
}
