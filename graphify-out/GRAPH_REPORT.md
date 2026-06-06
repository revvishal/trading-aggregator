# Graph Report - .  (2026-06-06)

## Corpus Check
- Corpus is ~21,538 words - fits in a single context window. You may not need a graph.

## Summary
- 282 nodes · 443 edges · 18 communities (14 shown, 4 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS · INFERRED: 1 edges (avg confidence: 0.9)
- Token cost: 19,684 input · 1,467 output

## Community Hubs (Navigation)
- [[_COMMUNITY_Community 0|Community 0]]
- [[_COMMUNITY_Community 1|Community 1]]
- [[_COMMUNITY_Community 2|Community 2]]
- [[_COMMUNITY_Community 3|Community 3]]
- [[_COMMUNITY_Community 4|Community 4]]
- [[_COMMUNITY_Community 5|Community 5]]
- [[_COMMUNITY_Community 6|Community 6]]
- [[_COMMUNITY_Community 7|Community 7]]
- [[_COMMUNITY_Community 8|Community 8]]
- [[_COMMUNITY_Community 9|Community 9]]
- [[_COMMUNITY_Community 10|Community 10]]
- [[_COMMUNITY_Community 11|Community 11]]
- [[_COMMUNITY_Community 12|Community 12]]
- [[_COMMUNITY_Community 13|Community 13]]
- [[_COMMUNITY_Community 14|Community 14]]
- [[_COMMUNITY_Community 15|Community 15]]

## God Nodes (most connected - your core abstractions)
1. `authHeaders()` - 30 edges
2. `handleResponse()` - 29 edges
3. `compilerOptions` - 16 edges
4. `compilerOptions` - 14 edges
5. `useAppContext()` - 11 edges
6. `scripts` - 9 edges
7. `fetchTickerFinancials()` - 6 edges
8. `pool` - 5 edges
9. `verifyToken()` - 5 edges
10. `scripts` - 4 edges

## Surprising Connections (you probably didn't know these)
- `Trading Aggregator Frontend` --implements--> `AppContext Reducer State Management`  [INFERRED]
  package.json → reducer-flow.md
- `System Architecture` --references--> `Trading Aggregator Frontend`  [EXTRACTED]
  README.md → package.json
- `System Architecture` --references--> `Trading Aggregator Backend`  [EXTRACTED]
  README.md → server/package.json
- `Trading Aggregator Backend` --implements--> `Webhook API (/api/webhook)`  [EXTRACTED]
  server/package.json → README.md
- `Trading Aggregator Backend` --implements--> `Zerodha Kite Integration`  [EXTRACTED]
  server/package.json → README.md

## Import Cycles
- None detected.

## Communities (18 total, 4 thin omitted)

### Community 0 - "Community 0"
Cohesion: 0.14
Nodes (37): appendMatchedTrades(), authHeaders(), clearAllData(), clearToken(), clearWebhookAlerts(), disconnectZerodha(), fetchAlerts(), fetchExitSummary() (+29 more)

### Community 1 - "Community 1"
Cohesion: 0.10
Nodes (28): Action, AppContext, AppContextType, AppProvider(), initialState, useAppContext(), getUsername(), isLoggedIn() (+20 more)

### Community 2 - "Community 2"
Cohesion: 0.09
Nodes (20): initDatabase(), pool, authMiddleware(), router, router, parseCSVLine(), parseFundamentalsCSV(), router (+12 more)

### Community 3 - "Community 3"
Cohesion: 0.09
Nodes (14): FinancialCardProps, JsonInputModalProps, ScoreBadgeProps, checkServerHealth(), fetchTickerFinancials(), getAnalystRecommendation(), getFinancialData(), orderTypeColor (+6 more)

### Community 4 - "Community 4"
Cohesion: 0.08
Nodes (24): dependencies, cors, dotenv, express, jsonwebtoken, kiteconnect, pg, uuid (+16 more)

### Community 5 - "Community 5"
Cohesion: 0.09
Nodes (22): dependencies, @emotion/react, @emotion/styled, http-proxy-middleware, @mui/icons-material, @mui/material, react, react-dom (+14 more)

### Community 6 - "Community 6"
Cohesion: 0.10
Nodes (19): browserslist, development, production, devDependencies, concurrently, eslintConfig, extends, name (+11 more)

### Community 7 - "Community 7"
Cohesion: 0.11
Nodes (17): compilerOptions, allowJs, allowSyntheticDefaultImports, esModuleInterop, forceConsistentCasingInFileNames, isolatedModules, jsx, lib (+9 more)

### Community 8 - "Community 8"
Cohesion: 0.12
Nodes (16): compilerOptions, declaration, declarationMap, esModuleInterop, forceConsistentCasingInFileNames, lib, module, outDir (+8 more)

### Community 9 - "Community 9"
Cohesion: 0.25
Nodes (7): background_color, display, icons, name, short_name, start_url, theme_color

### Community 11 - "Community 11"
Cohesion: 0.33
Nodes (7): Neon PostgreSQL Database, Trading Aggregator Frontend, System Architecture, AppContext Reducer State Management, Trading Aggregator Backend, Webhook API (/api/webhook), Zerodha Kite Integration

### Community 12 - "Community 12"
Cohesion: 0.40
Nodes (3): LoginProps, login(), setToken()

## Knowledge Gaps
- **126 isolated node(s):** `PreToolUse`, `name`, `version`, `private`, `@emotion/react` (+121 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **4 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `dependencies` connect `Community 5` to `Community 6`?**
  _High betweenness centrality (0.016) - this node is a cross-community bridge._
- **Why does `useAppContext()` connect `Community 1` to `Community 0`, `Community 3`?**
  _High betweenness centrality (0.007) - this node is a cross-community bridge._
- **What connects `PreToolUse`, `name`, `version` to the rest of the system?**
  _126 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Community 0` be split into smaller, more focused modules?**
  _Cohesion score 0.14304993252361672 - nodes in this community are weakly interconnected._
- **Should `Community 1` be split into smaller, more focused modules?**
  _Cohesion score 0.0953058321479374 - nodes in this community are weakly interconnected._
- **Should `Community 2` be split into smaller, more focused modules?**
  _Cohesion score 0.0873015873015873 - nodes in this community are weakly interconnected._
- **Should `Community 3` be split into smaller, more focused modules?**
  _Cohesion score 0.09259259259259259 - nodes in this community are weakly interconnected._