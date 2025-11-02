/**
 * LLM APIとの連携モジュール
 * Claude APIを使用してタブを分析し、グループ化の提案を取得します
 */

const STORAGE_KEY_API_KEY = "llm-api-key";
const STORAGE_KEY_LLM_OPTIONS = "llm-options";

/**
 * API Keyを保存する
 * @param {string} apiKey - Claude API Key
 */
export async function saveApiKey(apiKey) {
  await browser.storage.local.set({ [STORAGE_KEY_API_KEY]: apiKey });
}

/**
 * 保存されたAPI Keyを取得する
 * @returns {Promise<string|null>} API Key
 */
export async function getApiKey() {
  const result = await browser.storage.local.get(STORAGE_KEY_API_KEY);
  return result[STORAGE_KEY_API_KEY] || null;
}

/**
 * LLMオプションを保存する
 * @param {Object} options - LLMオプション
 */
export async function saveLLMOptions(options) {
  await browser.storage.local.set({ [STORAGE_KEY_LLM_OPTIONS]: options });
}

/**
 * LLMオプションを取得する
 * @returns {Promise<Object>} LLMオプション
 */
export async function getLLMOptions() {
  const result = await browser.storage.local.get(STORAGE_KEY_LLM_OPTIONS);
  return result[STORAGE_KEY_LLM_OPTIONS] || {
    enabled: false,
    autoGroupEnabled: false,
    intervalMinutes: 30,
    minTabsForGrouping: 5,
    model: "claude-3-haiku-20240307"
  };
}

/**
 * Claude APIを呼び出してタブを分析する
 * @param {Array} tabs - 分析対象のタブ配列
 * @returns {Promise<Object>} グループ化の提案
 */
export async function analyzeTabsWithLLM(tabs) {
  const apiKey = await getApiKey();

  if (!apiKey) {
    throw new Error("API Key is not configured. Please set it in the options page.");
  }

  const options = await getLLMOptions();

  // タブ情報を整形
  const tabData = tabs.map(tab => ({
    id: tab.id,
    title: tab.title,
    url: tab.url,
    domain: tab.domain || extractDomain(tab.url)
  }));

  // プロンプトを作成
  const prompt = `
以下のブラウザタブを関連性に基づいてグループ化してください。
各グループには適切な日本語の名前を付けてください。

タブ一覧:
${JSON.stringify(tabData, null, 2)}

グループ化の基準:
- ドメインが同じタブは基本的に同じグループにする
- 内容や目的が類似しているタブをまとめる
- 作業コンテキストが関連するタブをまとめる
- 1つのグループには最低2つのタブが必要（単独のタブはグループ化しない）

以下のJSON形式のみで回答してください（説明文は不要です）:
{
  "groups": [
    {
      "name": "グループ名",
      "tabIds": [タブIDの配列],
      "description": "グループの説明（簡潔に）"
    }
  ]
}
`;

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01"
      },
      body: JSON.stringify({
        model: options.model,
        max_tokens: 2000,
        messages: [{
          role: "user",
          content: prompt
        }]
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`API request failed: ${response.status} ${errorText}`);
    }

    const data = await response.json();
    const content = data.content[0].text;

    // JSONレスポンスをパース
    const result = parseJSONResponse(content);

    return result;
  } catch (error) {
    console.error("LLM API error:", error);
    throw error;
  }
}

/**
 * LLMからのレスポンスをパースする
 * マークダウンのコードブロックなども考慮する
 * @param {string} content - LLMからのレスポンス
 * @returns {Object} パースされたJSON
 */
function parseJSONResponse(content) {
  // マークダウンのコードブロックを削除
  let cleaned = content.trim();

  // ```json ... ``` の形式を処理
  const jsonBlockMatch = cleaned.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
  if (jsonBlockMatch) {
    cleaned = jsonBlockMatch[1];
  }

  // JSONとしてパース
  try {
    return JSON.parse(cleaned);
  } catch (e) {
    console.error("Failed to parse JSON:", cleaned);
    throw new Error("Failed to parse LLM response as JSON");
  }
}

/**
 * URLからドメインを抽出する
 * @param {string} url - URL
 * @returns {string} ドメイン
 */
function extractDomain(url) {
  try {
    const urlObj = new URL(url);
    return urlObj.hostname;
  } catch (e) {
    return "";
  }
}

/**
 * API Keyが設定されているかチェックする
 * @returns {Promise<boolean>} 設定されている場合true
 */
export async function isApiKeyConfigured() {
  const apiKey = await getApiKey();
  return !!apiKey;
}
