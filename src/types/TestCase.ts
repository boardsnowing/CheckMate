export interface TestStep {
  step: string;
  expected: string;
  result?: "OK" | "NG" | "N/A";
  commonProcedureRef?: {
    procedureId: string;
    procedureName: string;
  };
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

// 共通手順の型定義
export interface CommonProcedure {
  id: string;
  name: string;              // 名称（1行テキスト）
  description: string;       // 説明（複数行テキスト）
  steps: TestStep[];         // 複数の共通手順
}
