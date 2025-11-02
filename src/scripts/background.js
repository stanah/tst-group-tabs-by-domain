const TST_ID = "treestyletab@piro.sakura.ne.jp";

// import { createDebugMenu } from "./debug.js";
import { groupBy, matchGroupTab, sleep } from "./util.js";

import { createOptionsMenu, getOption } from "./options.js";
import { analyzeTabsWithLLM, getLLMOptions, isApiKeyConfigured } from "./llm.js";

// 設定の型を定義する
/**
 * @typedef {Object} Options 設定
 * @property {boolean} [debug] デバッグモードかどうか
 * @property {boolean} [autoGroupTabs] タブを自動的にグループ化するかどうか
 */

/**
 * @typedef {Object} TabWithDomain ドメイン情報を含むタブ
 * @property {string} id タブID
 * @property {string} windowId ウィンドウID
 * @property {string} title タブのタイトル
 * @property {string} url タブのURL
 * @property {string} domain タブのドメイン
 */

/**
 * 現在のウィンドウのタブを取得する
 * @returns {Promise<TabWithDomain[]>} タブの配列を返すPromise
 */
async function getCurrentWindowTabs() {
  const currentWindow = await browser.windows.getCurrent();
  const opts = { windowId: currentWindow.id };
  const tabs = await browser.tabs.query(opts);

  const tabsWithdomain = tabs.map((t) => {
    try {
      const url = new URL(t.url);
      return { ...t, domain: url.hostname };
    } catch (e) {
      // do nothing with bad URLs
      return t;
    }
  });

  return tabsWithdomain;
}

// グループ化から除外する
async function filterTabs(tabs) {
  return tabs
    .filter((t) => !t.pinned) // don't mess with pinned tabs
    .filter((t) => !t.url || !t.url.match(/^moz-extension:/)) // don't reorganize groups
    .filter((t) => t.domain?.length); // maybe couldn't parse URL for some reason
}

async function tstGroupTabs(groupName, tabIds) {
  const parentTab = browser.runtime.sendMessage(TST_ID, {
    type: "group-tabs",
    title: `${groupName}`,
    tabs: tabIds,
  });
  return parentTab;
}

async function groupAllTabs() {
  const tabs = await getCurrentWindowTabs();
  const filteredTabs = await filterTabs(tabs);
  const groups = groupBy(filteredTabs, "domain");

  const groupsWithMultiple = Object.entries(groups).filter((g) => g[1].length > 1);

  for (const [domain, group] of groupsWithMultiple) {
    for (const tab of group) {
      await browser.runtime.sendMessage(TST_ID, {
        type: "move-to-start",
        tab: tab.id,
      });
      await sleep(100);
    }

    const tabIds = group.map((t) => t.id);
    const parentTab = await tstGroupTabs(domain, tabIds);

    const faviconUrl = `http://www.google.com/s2/favicons?domain=${domain}`;
    await setFavicon(parentTab.id, faviconUrl);
    await sleep(1000);
  }
}

/**
 * LLMを使用してタブをグループ化する
 */
async function groupTabsWithLLM() {
  try {
    // API Keyが設定されているかチェック
    const hasApiKey = await isApiKeyConfigured();
    if (!hasApiKey) {
      console.error("API Key is not configured");
      browser.notifications.create({
        type: "basic",
        iconUrl: browser.runtime.getURL("icons/icon.svg"),
        title: "TST Auto Grouper",
        message: "API Keyが設定されていません。オプションページで設定してください。"
      });
      return;
    }

    // LLMが有効かチェック
    const options = await getLLMOptions();
    if (!options.enabled) {
      console.log("LLM grouping is disabled");
      return;
    }

    // タブを取得してフィルタリング
    const tabs = await getCurrentWindowTabs();
    const filteredTabs = await filterTabs(tabs);

    if (filteredTabs.length < 2) {
      console.log("Not enough tabs to group");
      return;
    }

    // LLMでタブを分析
    console.log("Analyzing tabs with LLM...");
    const result = await analyzeTabsWithLLM(filteredTabs);

    if (!result || !result.groups || result.groups.length === 0) {
      console.log("No groups suggested by LLM");
      return;
    }

    // グループを作成
    console.log("Creating groups:", result.groups);
    for (const group of result.groups) {
      if (!group.tabIds || group.tabIds.length < 2) {
        continue;
      }

      // グループのタブを先頭に移動
      for (const tabId of group.tabIds) {
        try {
          await browser.runtime.sendMessage(TST_ID, {
            type: "move-to-start",
            tab: tabId,
          });
          await sleep(100);
        } catch (e) {
          console.error("Failed to move tab:", tabId, e);
        }
      }

      // グループを作成
      const parentTab = await tstGroupTabs(group.name, group.tabIds);

      // グループの最初のタブのドメインからfaviconを取得
      const firstTab = filteredTabs.find(t => t.id === group.tabIds[0]);
      if (firstTab && firstTab.domain) {
        const faviconUrl = `http://www.google.com/s2/favicons?domain=${firstTab.domain}`;
        await setFavicon(parentTab.id, faviconUrl);
      }

      await sleep(1000);
    }

    // 成功通知
    browser.notifications.create({
      type: "basic",
      iconUrl: browser.runtime.getURL("icons/icon.svg"),
      title: "TST Auto Grouper",
      message: `${result.groups.length}個のグループを作成しました`
    });

  } catch (error) {
    console.error("Failed to group tabs with LLM:", error);
    browser.notifications.create({
      type: "basic",
      iconUrl: browser.runtime.getURL("icons/icon.svg"),
      title: "TST Auto Grouper - エラー",
      message: "タブのグループ化に失敗しました: " + error.message
    });
  }
}

async function setFavicon(tabId, imageUrl) {
  const BASE_STYLE = `
  ::part(%EXTRA_CONTENTS_PART% container) {
    opacity: 100%;
    height: 100%;
    padding-left: 20px;
    z-index: 2000;
    display: flex;
    align-items: center; /* 垂直方向中央揃え */
  }
  `;

  try {
    // group-tabのアイコンを表示しない
    await browser.runtime.sendMessage(TST_ID, {
      type: "register-self",
      style: `
      :root.simulate-svg-context-fill tab-item.group-tab .favicon-builtin::before {
        background: transparent var(--icon-folder) no-repeat center / 100%;
        mask: none;
      }
      `,
    });

    // faviconを取得する
    const response = await fetch(imageUrl);
    const blob = await response.blob();
    const base64data = await blobToBase64(blob);

    const iconSize = "16px";
    // set-extra-contentsでfaviconを表示する
    await browser.runtime.sendMessage(TST_ID, {
      type: "set-extra-contents",
      place: "tab-behind", // "tab-front",
      tab: tabId,
      contents: `<span id="favicon" part="favicon"><img src="${base64data}" width="${iconSize}" height="${iconSize}" part="img"></span>`,
      style: BASE_STYLE,
    });
  } catch (error) {
    console.error("Error fetching image:", error);
  }
}

function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

async function getGroupTab(groupName) {
  const tabs = await getCurrentWindowTabs();
  const groupTabs = tabs.filter((tab) => matchGroupTab(tab.url)).filter((t) => t.title === groupName);
  if (groupTabs.length === 0) {
    return null;
  }
  if (groupTabs.length > 1) {
    console.error("too many group tabs");
    return null;
    // return groupTabs[0];
  }
  return groupTabs[0];
}

async function insertTabToGroup(tabId) {
  const autoGroupEnable = await getOption("autoGroupEnable");
  if (!autoGroupEnable) return;

  // タブIDを指定してタブを取得する
  const tab = await browser.tabs.get(tabId);
  if (matchGroupTab(tab.url)) {
    console.log("ignore group tab");
    return;
  }

  // タブのドメインを取得する
  const url = new URL(tab.url);
  const domain = url.hostname;

  // 同一ドメインのグループタブを取得する
  const group = await getGroupTab(domain);
  if (group == null) return;

  await browser.runtime.sendMessage(TST_ID, {
    type: "attach",
    parent: group.id,
    child: tabId,
  });
}

// 自動グループ化のインターバルID
let autoGroupInterval = null;

/**
 * 自動グループ化を開始する
 */
async function startAutoGrouping() {
  // 既存のインターバルをクリア
  if (autoGroupInterval) {
    clearInterval(autoGroupInterval);
    autoGroupInterval = null;
  }

  const options = await getLLMOptions();

  if (!options.enabled || !options.autoGroupEnabled) {
    console.log("Auto grouping is disabled");
    return;
  }

  console.log(`Starting auto grouping with interval: ${options.intervalMinutes} minutes`);

  // インターバルを設定
  autoGroupInterval = setInterval(async () => {
    try {
      const tabs = await getCurrentWindowTabs();
      const filteredTabs = await filterTabs(tabs);

      if (filteredTabs.length >= options.minTabsForGrouping) {
        console.log("Auto grouping triggered");
        await groupTabsWithLLM();
      }
    } catch (error) {
      console.error("Auto grouping error:", error);
    }
  }, options.intervalMinutes * 60 * 1000);
}

/**
 * 自動グループ化を停止する
 */
function stopAutoGrouping() {
  if (autoGroupInterval) {
    clearInterval(autoGroupInterval);
    autoGroupInterval = null;
    console.log("Auto grouping stopped");
  }
}

// Listeners
// ボタンがクリックされたときに呼び出されるリスナー
browser.browserAction.onClicked.addListener(() => {
  groupAllTabs();
});

// タブが更新されたときに呼び出されるリスナー
browser.tabs.onUpdated.addListener((tabId) => {
  insertTabToGroup(tabId);
});

// メッセージリスナー
browser.runtime.onMessage.addListener((message, sender) => {
  if (message.type === "llm-group-tabs") {
    // LLMグループ化を実行
    groupTabsWithLLM();
  } else if (message.type === "settings-updated") {
    // 設定が更新されたら自動グループ化を再起動
    startAutoGrouping();
  }
});

browser.runtime.onMessageExternal.addListener((message, sender) => {
  // console.log("message", message, sender);
});

// 初期化
createOptionsMenu();
startAutoGrouping();
