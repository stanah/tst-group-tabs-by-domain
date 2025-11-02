/**
 * オプションページのロジック
 */

import { saveApiKey, getApiKey, saveLLMOptions, getLLMOptions } from "./llm.js";

// DOM要素
let apiKeyInput;
let modelSelect;
let llmEnabledCheckbox;
let autoGroupEnabledCheckbox;
let intervalMinutesInput;
let minTabsInput;
let saveBtn;
let testBtn;
let statusMessage;
let advancedSettings;

// 初期化
document.addEventListener("DOMContentLoaded", async () => {
  // DOM要素を取得
  apiKeyInput = document.getElementById("apiKey");
  modelSelect = document.getElementById("modelSelect");
  llmEnabledCheckbox = document.getElementById("llmEnabled");
  autoGroupEnabledCheckbox = document.getElementById("autoGroupEnabled");
  intervalMinutesInput = document.getElementById("intervalMinutes");
  minTabsInput = document.getElementById("minTabs");
  saveBtn = document.getElementById("saveBtn");
  testBtn = document.getElementById("testBtn");
  statusMessage = document.getElementById("statusMessage");
  advancedSettings = document.getElementById("advancedSettings");

  // イベントリスナーを設定
  saveBtn.addEventListener("click", handleSave);
  testBtn.addEventListener("click", handleTest);
  llmEnabledCheckbox.addEventListener("change", handleLLMEnabledChange);

  // 保存された設定を読み込む
  await loadSettings();
});

/**
 * 保存された設定を読み込む
 */
async function loadSettings() {
  try {
    // API Keyを読み込む（セキュリティのため表示はしない）
    const apiKey = await getApiKey();
    if (apiKey) {
      apiKeyInput.placeholder = "設定済み（変更する場合は新しいキーを入力）";
    }

    // LLMオプションを読み込む
    const options = await getLLMOptions();

    modelSelect.value = options.model || "claude-3-haiku-20240307";
    llmEnabledCheckbox.checked = options.enabled || false;
    autoGroupEnabledCheckbox.checked = options.autoGroupEnabled || false;
    intervalMinutesInput.value = options.intervalMinutes || 30;
    minTabsInput.value = options.minTabsForGrouping || 5;

    // LLMが有効でない場合は詳細設定を無効化
    if (!llmEnabledCheckbox.checked) {
      advancedSettings.classList.add("disabled");
    }
  } catch (error) {
    console.error("Failed to load settings:", error);
    showStatus("設定の読み込みに失敗しました", "error");
  }
}

/**
 * 設定を保存する
 */
async function handleSave() {
  try {
    // API Keyを保存（入力されている場合のみ）
    if (apiKeyInput.value.trim()) {
      await saveApiKey(apiKeyInput.value.trim());
    }

    // LLMオプションを保存
    const options = {
      enabled: llmEnabledCheckbox.checked,
      autoGroupEnabled: autoGroupEnabledCheckbox.checked,
      intervalMinutes: parseInt(intervalMinutesInput.value, 10),
      minTabsForGrouping: parseInt(minTabsInput.value, 10),
      model: modelSelect.value
    };

    await saveLLMOptions(options);

    // 保存後、入力フィールドをクリア
    apiKeyInput.value = "";
    apiKeyInput.placeholder = "設定済み（変更する場合は新しいキーを入力）";

    showStatus("設定を保存しました", "success");

    // バックグラウンドスクリプトに設定変更を通知
    browser.runtime.sendMessage({ type: "settings-updated" });
  } catch (error) {
    console.error("Failed to save settings:", error);
    showStatus("設定の保存に失敗しました: " + error.message, "error");
  }
}

/**
 * API接続をテストする
 */
async function handleTest() {
  try {
    showStatus("接続をテストしています...", "success");
    testBtn.disabled = true;

    const apiKey = apiKeyInput.value.trim() || await getApiKey();

    if (!apiKey) {
      showStatus("API Keyが設定されていません", "error");
      testBtn.disabled = false;
      return;
    }

    const options = await getLLMOptions();
    const model = modelSelect.value || options.model;

    // シンプルなテストリクエストを送信
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01"
      },
      body: JSON.stringify({
        model: model,
        max_tokens: 50,
        messages: [{
          role: "user",
          content: "Hello"
        }]
      })
    });

    if (response.ok) {
      showStatus("接続テスト成功！APIは正常に動作しています", "success");
    } else {
      const errorData = await response.json();
      showStatus(`接続テスト失敗: ${errorData.error?.message || response.statusText}`, "error");
    }
  } catch (error) {
    console.error("Test failed:", error);
    showStatus("接続テスト失敗: " + error.message, "error");
  } finally {
    testBtn.disabled = false;
  }
}

/**
 * LLM有効化チェックボックスの変更処理
 */
function handleLLMEnabledChange() {
  if (llmEnabledCheckbox.checked) {
    advancedSettings.classList.remove("disabled");
  } else {
    advancedSettings.classList.add("disabled");
  }
}

/**
 * ステータスメッセージを表示する
 * @param {string} message - メッセージ
 * @param {string} type - "success" または "error"
 */
function showStatus(message, type) {
  statusMessage.textContent = message;
  statusMessage.className = `status-message ${type}`;
  statusMessage.style.display = "block";

  // 3秒後に非表示にする
  setTimeout(() => {
    statusMessage.style.display = "none";
  }, 3000);
}
