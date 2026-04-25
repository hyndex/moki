# Graph Report - quizzical-lamport-bd9d37  (2026-04-25)

## Corpus Check
- 440 files · ~492,899 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 2036 nodes · 3427 edges · 42 communities detected
- Extraction: 73% EXTRACTED · 27% INFERRED · 0% AMBIGUOUS · INFERRED: 936 edges (avg confidence: 0.8)
- Token cost: 0 input · 0 output

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
- [[_COMMUNITY_Community 16|Community 16]]
- [[_COMMUNITY_Community 17|Community 17]]
- [[_COMMUNITY_Community 18|Community 18]]
- [[_COMMUNITY_Community 19|Community 19]]
- [[_COMMUNITY_Community 20|Community 20]]
- [[_COMMUNITY_Community 21|Community 21]]
- [[_COMMUNITY_Community 22|Community 22]]
- [[_COMMUNITY_Community 23|Community 23]]
- [[_COMMUNITY_Community 24|Community 24]]
- [[_COMMUNITY_Community 25|Community 25]]
- [[_COMMUNITY_Community 26|Community 26]]
- [[_COMMUNITY_Community 28|Community 28]]
- [[_COMMUNITY_Community 29|Community 29]]
- [[_COMMUNITY_Community 30|Community 30]]
- [[_COMMUNITY_Community 31|Community 31]]
- [[_COMMUNITY_Community 32|Community 32]]
- [[_COMMUNITY_Community 33|Community 33]]
- [[_COMMUNITY_Community 34|Community 34]]
- [[_COMMUNITY_Community 35|Community 35]]
- [[_COMMUNITY_Community 37|Community 37]]
- [[_COMMUNITY_Community 38|Community 38]]
- [[_COMMUNITY_Community 41|Community 41]]
- [[_COMMUNITY_Community 42|Community 42]]
- [[_COMMUNITY_Community 43|Community 43]]
- [[_COMMUNITY_Community 48|Community 48]]
- [[_COMMUNITY_Community 49|Community 49]]

## God Nodes (most connected - your core abstractions)
1. `String()` - 91 edges
2. `replace()` - 54 edges
3. `scaffoldBusinessPlugin()` - 48 edges
4. `parse()` - 41 edges
5. `run()` - 38 edges
6. `useAllRecords()` - 34 edges
7. `seedAll()` - 27 edges
8. `scaffoldBusinessPackCatalog()` - 26 edges
9. `extractLibraryFacts()` - 26 edges
10. `extractPluginFacts()` - 25 edges

## Surprising Connections (you probably didn't know these)
- `escapeTsString()` --calls--> `String()`  [INFERRED]
  tooling/plugin-docs/generate.mjs → admin-panel/src/examples/_factory/detailFromZod.tsx
- `buildBasePathMap()` --calls--> `walk()`  [INFERRED]
  admin-panel/src/examples/_factory/richDetailFactory.tsx → tooling/library-docs/lib.mjs
- `log()` --calls--> `main()`  [INFERRED]
  admin-panel/scripts/gutu-plugin.mjs → tooling/business-os/run-resilience-flows.mjs
- `log()` --calls--> `main()`  [INFERRED]
  admin-panel/scripts/gutu-plugin.mjs → tooling/business-os/run-e2e-flows.mjs
- `log()` --calls--> `main()`  [INFERRED]
  admin-panel/scripts/gutu-plugin.mjs → tooling/business-os/scaffold.mjs

## Communities

### Community 0 - "Community 0"
Cohesion: 0.02
Nodes (141): effectiveRole(), grantAcl(), listAcl(), purgeAclForRecord(), revokeAcl(), roleAtLeast(), roleFromLinkToken(), seedDefaultAcl() (+133 more)

### Community 1 - "Community 1"
Cohesion: 0.01
Nodes (47): fetchAll(), monthKey(), fetchAll(), fetchAll(), fetchAll(), fetchAll(), fetchAll(), fetchAll() (+39 more)

### Community 2 - "Community 2"
Cohesion: 0.02
Nodes (90): runContractScenario(), runLifecycleScenario(), code(), count(), seedCmmsExtended(), seedIf(), appointments(), campaigns() (+82 more)

### Community 3 - "Community 3"
Cohesion: 0.04
Nodes (110): buildImportList(), capitalize(), createDocsCheckScript(), createSummaryScript(), createWorkspaceRunnerScript(), describeUiSurface(), ensureScripts(), escapeTsString() (+102 more)

### Community 4 - "Community 4"
Cohesion: 0.03
Nodes (58): addLeaf(), emit(), emptyLeaf(), isLeaf(), removeAt(), updateAt(), toggleAll(), toggleRow() (+50 more)

### Community 5 - "Community 5"
Cohesion: 0.03
Nodes (62): code(), count(), personName(), pick(), seedAssetsExtended(), seedIf(), code(), count() (+54 more)

### Community 6 - "Community 6"
Cohesion: 0.05
Nodes (51): createActivationEngine(), apiBase(), createEditorRecord(), createPublicLink(), deleteEditorRecord(), fetchEditorRecord(), fetchSnapshot(), getAuthHeaders() (+43 more)

### Community 7 - "Community 7"
Cohesion: 0.03
Nodes (39): ApiError, apiFetch(), AuthStore, fetchMemberships(), fetchPlatformConfig(), login(), logout(), signup() (+31 more)

### Community 8 - "Community 8"
Cohesion: 0.05
Nodes (75): buildDependencyContractsFromLists(), dedupeList(), deriveSuggestedPackIds(), main(), renderActions(), renderAdminContributions(), renderAdminPage(), renderBusinessPackAutomation() (+67 more)

### Community 9 - "Community 9"
Cohesion: 0.04
Nodes (38): count(), personEmail(), personName(), pick(), seedAuthExtended(), seedIf(), sanitizeForHeader(), code() (+30 more)

### Community 10 - "Community 10"
Cohesion: 0.05
Nodes (44): bootstrapStorage(), localDefaultConfig(), parseStorageBackendsEnv(), s3DefaultFromEnv(), envEnum(), envFlag(), envInt(), loadConfig() (+36 more)

### Community 11 - "Community 11"
Cohesion: 0.04
Nodes (34): AdminInner(), AppShell(), useLiveAudit(), buildDomainPlugin(), buildResource(), useRuntime(), detailViewFromZod(), RichZodDetailPage() (+26 more)

### Community 12 - "Community 12"
Cohesion: 0.07
Nodes (21): send(), fromAsyncIterable(), fromChunk(), fromIterable(), toReadableStream(), seedFactory(), writeFile(), joinTenantKey() (+13 more)

### Community 13 - "Community 13"
Cohesion: 0.06
Nodes (32): accessibleRecordIds(), ErrorBoundary, __resetEventBus(), subscribeRecordEvents(), asLocale(), deepMerge(), mergeLocales(), mountAdapter() (+24 more)

### Community 14 - "Community 14"
Cohesion: 0.06
Nodes (22): AnalyticsEmitterImpl, createAnalytics(), ensureSessionId(), createRuntime(), createCapabilityRegistry(), createFeatureFlags(), createPermissionEvaluator(), evalCondition() (+14 more)

### Community 15 - "Community 15"
Cohesion: 0.09
Nodes (36): AutomationRunDetailPage(), BookingDashboardKpis(), pct(), CrmOverviewPage(), useActivities(), useContacts(), useDeals(), useEdges() (+28 more)

### Community 16 - "Community 16"
Cohesion: 0.11
Nodes (18): buildPluginContext(), CapabilityError, createContributionStore(), makeAnalytics(), makeAssetResolver(), makeContributions(), makeI18n(), makeLogger() (+10 more)

### Community 17 - "Community 17"
Cohesion: 0.13
Nodes (21): checkCatalog(), checkPluginDocs(), main(), missingHeadings(), placeholderFailures(), cmdCreate(), cmdHelp(), cmdList() (+13 more)

### Community 18 - "Community 18"
Cohesion: 0.14
Nodes (20): batches(), bins(), code(), count(), deliveryNotes(), deliveryTrips(), items(), itemSuppliers() (+12 more)

### Community 19 - "Community 19"
Cohesion: 0.14
Nodes (14): apiBase(), authHeaders(), createField(), deleteField(), listFields(), onConfirmDelete(), onDragEnd(), onSaved() (+6 more)

### Community 20 - "Community 20"
Cohesion: 0.17
Nodes (15): bankAccounts(), bankTransactions(), budgets(), code(), costCenters(), count(), currencyRates(), dunning() (+7 more)

### Community 21 - "Community 21"
Cohesion: 0.16
Nodes (13): handleApply(), handler(), setLink(), handler(), buildAdvanceInput(), buildCreateInput(), buildReconcileInput(), loadPluginModule() (+5 more)

### Community 22 - "Community 22"
Cohesion: 0.2
Nodes (14): cannedResponses(), code(), count(), csatResponses(), escalations(), kbArticles(), personName(), pick() (+6 more)

### Community 23 - "Community 23"
Cohesion: 0.13
Nodes (8): AccessDenied, ChecksumMismatch, InvalidKey, isRetryableByDefault(), ObjectNotFound, PayloadTooLarge, StorageError, Unsupported

### Community 24 - "Community 24"
Cohesion: 0.13
Nodes (6): fmt(), formatValue(), cn(), fmt(), fmt(), if()

### Community 25 - "Community 25"
Cohesion: 0.18
Nodes (3): dealStageLabel(), pick(), dealStageIntent()

### Community 26 - "Community 26"
Cohesion: 0.47
Nodes (2): MockBackend, sleep()

### Community 28 - "Community 28"
Cohesion: 0.31
Nodes (5): formatCurrency(), formatDate(), formatDateTime(), formatNumber(), renderCellValue()

### Community 29 - "Community 29"
Cohesion: 0.39
Nodes (6): aggregate(), bucketKey(), computeAggregation(), evalFilter(), evalLeaf(), previousRange()

### Community 30 - "Community 30"
Cohesion: 0.36
Nodes (6): buildShareableUrl(), getCurrentRoutePath(), parseHash(), useUrlJsonParam(), useUrlParam(), useUrlParams()

### Community 31 - "Community 31"
Cohesion: 0.33
Nodes (3): loadPersonalization(), saveEdit(), savePersonalization()

### Community 32 - "Community 32"
Cohesion: 0.43
Nodes (4): buildFilterState(), buildFilterTree(), collapse(), toLeaf()

### Community 33 - "Community 33"
Cohesion: 0.52
Nodes (6): globRoots(), listStandaloneRoots(), listTrackedOffenders(), listVisibleStandaloneStatus(), runGit(), safeList()

### Community 34 - "Community 34"
Cohesion: 0.33
Nodes (3): BarChart(), niceScale(), LineChart()

### Community 35 - "Community 35"
Cohesion: 0.33
Nodes (1): PluginBoundary

### Community 37 - "Community 37"
Cohesion: 0.47
Nodes (3): getTheme(), setTheme(), toggleTheme()

### Community 38 - "Community 38"
Cohesion: 0.5
Nodes (2): post(), setPosts()

### Community 41 - "Community 41"
Cohesion: 0.67
Nodes (2): attachRpcHandler(), spawnIframeSandbox()

### Community 42 - "Community 42"
Cohesion: 0.67
Nodes (2): attachWorkerRpc(), spawnWorkerSandbox()

### Community 43 - "Community 43"
Cohesion: 1.0
Nodes (2): isSecretKey(), scrubConfig()

### Community 48 - "Community 48"
Cohesion: 1.0
Nodes (2): NavIcon(), toPascal()

### Community 49 - "Community 49"
Cohesion: 0.67
Nodes (1): activate()

## Knowledge Gaps
- **Thin community `Community 26`** (10 nodes): `mockBackend.ts`, `MockBackend`, `.create()`, `.delete()`, `.ensure()`, `.get()`, `.list()`, `.seed()`, `.update()`, `sleep()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 35`** (6 nodes): `PluginBoundary.tsx`, `DefaultFallback()`, `PluginBoundary`, `.componentDidCatch()`, `.getDerivedStateFromError()`, `.render()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 38`** (5 nodes): `community-pages.tsx`, `action()`, `on()`, `post()`, `setPosts()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 41`** (4 nodes): `iframeSandbox.tsx`, `attachRpcHandler()`, `dispatchRpc()`, `spawnIframeSandbox()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 42`** (4 nodes): `workerSandbox.ts`, `attachWorkerRpc()`, `dispatchWorkerRpc()`, `spawnWorkerSandbox()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 43`** (3 nodes): `storage.ts`, `isSecretKey()`, `scrubConfig()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 48`** (3 nodes): `NavIcon.tsx`, `NavIcon()`, `toPascal()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 49`** (3 nodes): `plugin.tsx`, `plugin.tsx`, `activate()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `String()` connect `Community 2` to `Community 0`, `Community 1`, `Community 3`, `Community 4`, `Community 5`, `Community 6`, `Community 7`, `Community 9`, `Community 10`, `Community 11`, `Community 12`, `Community 13`, `Community 18`, `Community 19`, `Community 20`, `Community 21`, `Community 22`, `Community 24`, `Community 26`, `Community 29`, `Community 30`, `Community 32`?**
  _High betweenness centrality (0.256) - this node is a cross-community bridge._
- **Why does `replace()` connect `Community 9` to `Community 0`, `Community 2`, `Community 3`, `Community 4`, `Community 5`, `Community 6`, `Community 7`, `Community 8`, `Community 10`, `Community 11`, `Community 12`, `Community 13`, `Community 14`, `Community 16`, `Community 19`, `Community 21`?**
  _High betweenness centrality (0.128) - this node is a cross-community bridge._
- **Why does `seedAll()` connect `Community 2` to `Community 0`, `Community 3`, `Community 5`, `Community 9`, `Community 12`, `Community 17`, `Community 18`, `Community 20`, `Community 22`?**
  _High betweenness centrality (0.083) - this node is a cross-community bridge._
- **Are the 90 inferred relationships involving `String()` (e.g. with `setup()` and `code()`) actually correct?**
  _`String()` has 90 INFERRED edges - model-reasoned connections that need verification._
- **Are the 52 inferred relationships involving `replace()` (e.g. with `personEmail()` and `personEmail()`) actually correct?**
  _`replace()` has 52 INFERRED edges - model-reasoned connections that need verification._
- **Are the 37 inferred relationships involving `parse()` (e.g. with `readGutuPlugins()` and `migrate()`) actually correct?**
  _`parse()` has 37 INFERRED edges - model-reasoned connections that need verification._
- **Are the 34 inferred relationships involving `run()` (e.g. with `migrate()` and `resolveAuthUser()`) actually correct?**
  _`run()` has 34 INFERRED edges - model-reasoned connections that need verification._