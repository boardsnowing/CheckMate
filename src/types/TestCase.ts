export interface TestStep {
  step: string;
  expected: string;
  result?: "OK" | "NG" | "N/A";
}

export interface TestCase {
  id: string;
  name: string;
  steps: TestStep[];
  result?: "OK" | "NG" | "未実施";
}

export interface PreconditionDetails {
  purpose?: string;      // 目的
  environment?: string;  // 環境
  tools?: string;        // 使用ツール
  preparation?: string;  // 事前準備
}

export interface TestSuite {
  id: string;
  name: string;
  precondition: string;  // 既存形式（下位互換用）
  // 新規追加
  purpose?: string;
  environment?: string;
  tools?: string;
  preparation?: string;
  test_cases: TestCase[];
}
