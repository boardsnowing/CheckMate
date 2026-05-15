import { PreconditionDetails } from "../types/TestCase";

/**
 * セクションヘッダーを検出してテキストを抽出する
 */
function extractSection(markdown: string, headerPatterns: string[]): string | undefined {
  if (!markdown) return undefined;

  for (const pattern of headerPatterns) {
    // ## パターンまたは # パターンに対応
    const regex = new RegExp(`^#{1,2}\\s*${pattern}\\s*$`, 'mi');
    const match = markdown.match(regex);

    if (match) {
      const startIndex = match.index! + match[0].length;

      // 次のセクションヘッダーまたは文末を検出
      const nextHeaderRegex = /^#{1,2}\s+/m;
      const remaining = markdown.slice(startIndex);
      const nextMatch = remaining.match(nextHeaderRegex);

      let endIndex = remaining.length;
      if (nextMatch) {
        endIndex = nextMatch.index!;
      }

      const content = remaining.slice(0, endIndex).trim();
      return content || undefined;
    }
  }

  return undefined;
}

/**
 * レガシー形式の事前条件Markdownから4項目に分離
 */
export function parseLegacyPrecondition(markdown: string): PreconditionDetails {
  if (!markdown || markdown.trim() === "") {
    return {};
  }

  const sections: PreconditionDetails = {
    purpose: extractSection(markdown, ['目的', 'Purpose', '目標']),
    environment: extractSection(markdown, ['環境', 'Environment', '実行環境']),
    tools: extractSection(markdown, ['使用ツール', 'ツール', 'Tools', '必要ツール']),
    preparation: extractSection(markdown, ['事前準備', '準備', 'Preparation', '前提条件'])
  };

  // どの項目にも分離できない場合は、「事前準備」欄に全体を配置
  const hasAnySection = Object.values(sections).some(value => value !== undefined);
  if (!hasAnySection) {
    return { preparation: markdown };
  }

  return sections;
}

/**
 * 4項目から統合Markdown文字列を生成
 */
export function generateUnifiedPrecondition(details: PreconditionDetails): string {
  if (!details) return "";

  const sections: string[] = [];

  if (details.purpose) {
    sections.push(`## 目的\n\n${details.purpose}`);
  }

  if (details.environment) {
    sections.push(`## 環境\n\n${details.environment}`);
  }

  if (details.tools) {
    sections.push(`## 使用ツール\n\n${details.tools}`);
  }

  if (details.preparation) {
    sections.push(`## 事前準備\n\n${details.preparation}`);
  }

  return sections.join('\n\n');
}

/**
 * 新形式のデータが存在するかチェック
 */
export function hasNewFormat(data: any): boolean {
  return !!(data.purpose || data.environment || data.tools || data.preparation);
}

/**
 * 新形式から PreconditionDetails を抽出
 */
export function extractNewFormat(data: any): PreconditionDetails {
  return {
    purpose: data.purpose || undefined,
    environment: data.environment || undefined,
    tools: data.tools || undefined,
    preparation: data.preparation || undefined,
  };
}

/**
 * 4項目データから下位互換用の統合文字列を生成（エスケープ処理付き）
 */
export function generateLegacyPrecondition(details: PreconditionDetails): string {
  const unified = generateUnifiedPrecondition(details);
  return unified.replace(/\n/g, "\\n").replace(/\t/g, "\\t");
}

/**
 * PreconditionDetails が空かチェック
 */
export function isEmpty(details: PreconditionDetails): boolean {
  return !details.purpose && !details.environment && !details.tools && !details.preparation;
}