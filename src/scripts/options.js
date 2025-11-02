import { createDebugMenu } from "./debug.js";

async function addOptionMenu(id, title, contexts, type) {
  await browser.contextMenus.create({
    id: id,
    title: title,
    contexts: contexts,
    onclick: (info, tab) => saveOptions(id, info.checked),
    type: type,
  });
}

const OPTIONS_KEY = "tst-group-tabs-options";

const saveOptions = async (key, value) => {
  // 現在のオプションを取得する
  const item = (await browser.storage.local.get(OPTIONS_KEY)) || {};
  const newOptions = item[OPTIONS_KEY];
  newOptions[key] = value;

  await browser.storage.local.set({ [OPTIONS_KEY]: newOptions });

  await createOptionsMenu();
};

export const getOption = async (name) => {
  const item = (await browser.storage.local.get(OPTIONS_KEY)) || {};
  const newOptions = item[OPTIONS_KEY];
  return newOptions[name];
};

export async function createOptionsMenu() {
  console.log("createOptionsMenu");
  await browser.contextMenus.removeAll();

  await addOptionMenu("debugEnable", "Debug mode", ["browser_action"], "checkbox");
  await addOptionMenu("autoGroupEnable", "Auto group tabs", ["browser_action"], "checkbox");

  // LLMグループ化メニューを追加
  await browser.contextMenus.create({
    id: "llmGroupTabs",
    title: "LLMでグループ化",
    contexts: ["browser_action"],
    onclick: () => {
      browser.runtime.sendMessage({ type: "llm-group-tabs" });
    }
  });

  // オプションページを開くメニュー
  await browser.contextMenus.create({
    id: "openOptions",
    title: "LLM設定を開く",
    contexts: ["browser_action"],
    onclick: () => {
      browser.runtime.openOptionsPage();
    }
  });

  const options = await browser.storage.local.get(OPTIONS_KEY);
  const currentOptions = options[OPTIONS_KEY];
  if (currentOptions.debugEnable) {
    await createDebugMenu();
  }

  await restoreOptions();
}

const restoreOptions = async () => {
  const options = await browser.storage.local.get(OPTIONS_KEY);
  const currentOptions = options[OPTIONS_KEY];
  for (const [key, value] of Object.entries(currentOptions)) {
    browser.contextMenus.update(key, { checked: value });
  }
};
document.addEventListener("DOMContentLoaded", restoreOptions);
