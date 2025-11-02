# TST Group Tabs By Domain

This extension works with Tree Style Tab to group tabs by their domain. It supports both domain-based grouping and intelligent LLM-powered grouping using Claude AI. It only groups tabs from domains that include more than one tab. It doesn't modify pinned tabs.

## Features

### Domain-based Grouping (Original)
- Automatically groups tabs by their domain
- Only groups domains with 2+ tabs
- Doesn't modify pinned tabs
- Real-time auto-grouping for new tabs

### LLM-powered Grouping (New!)
- Uses Claude AI to intelligently analyze and group tabs
- Groups tabs by context and purpose, not just domain
- Understands semantic relationships between tabs
- Supports manual and automatic grouping modes

## Setup

### Prerequisites
- Firefox browser
- Tree Style Tab extension installed
- Claude API key (for LLM features) - Get one at [Anthropic Console](https://console.anthropic.com/)

### LLM Configuration

1. Open the extension options page (right-click extension icon → "LLM設定を開く")
2. Enter your Claude API key
3. Select the model you want to use:
   - **Claude 3 Haiku**: Fast and cost-effective (recommended)
   - **Claude 3.5 Sonnet**: Balanced performance
   - **Claude 3 Opus**: Highest accuracy
4. Enable LLM-based grouping
5. (Optional) Enable auto-grouping and configure:
   - Grouping interval (in minutes)
   - Minimum number of tabs before auto-grouping triggers

## Usage

### Manual Grouping

**Domain-based**: Click the extension icon to group all tabs by domain

**LLM-based**: Right-click the extension icon → "LLMでグループ化"

### Auto Grouping

- **Domain-based**: Enable "Auto group tabs" in the context menu
- **LLM-based**: Enable in the options page and configure the interval

## Build Instructions

1. Clone the repository: `git clone https://github.com/stanah/tst-group-tabs-by-domain.git`
2. Navigate to the project directory: `cd tst-group-tabs-by-domain`
3. Install the dependencies: `yarn install`
4. Build the project: `yarn build`
5. Install `web-ext-artifacts/tst_group_tabs_by_domain-x.x.x.zip` from the Firefox extensions page

## Privacy & Security

- Your API key is stored locally in your browser
- All API requests go directly from your browser to Anthropic
- No data is sent to any third-party servers
- Tab information shared with Claude includes only: title, URL, and domain

## Cost Considerations

LLM grouping makes API calls to Claude. Approximate costs (as of 2024):
- Claude 3 Haiku: ~$0.001 per grouping operation
- Claude 3.5 Sonnet: ~$0.005 per grouping operation
- Claude 3 Opus: ~$0.02 per grouping operation

Auto-grouping frequency and number of tabs affect total costs.

## License

MIT
