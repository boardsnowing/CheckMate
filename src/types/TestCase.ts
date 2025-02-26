export interface TestStep {
  step: string;
  expected: string;
  result?: "OK" | "NG" | "N/A";
}

export interface TestCase {
  id: string;
  name: string;
  steps: TestStep[];
}
