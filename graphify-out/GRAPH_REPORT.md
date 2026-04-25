# Graph Report - Framework  (2026-04-25)

## Corpus Check
- 3277 files · ~5,974,363 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 6527 nodes · 8039 edges · 62 communities detected
- Extraction: 78% EXTRACTED · 22% INFERRED · 0% AMBIGUOUS · INFERRED: 1730 edges (avg confidence: 0.8)
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
- [[_COMMUNITY_Community 27|Community 27]]
- [[_COMMUNITY_Community 28|Community 28]]
- [[_COMMUNITY_Community 29|Community 29]]
- [[_COMMUNITY_Community 30|Community 30]]
- [[_COMMUNITY_Community 31|Community 31]]
- [[_COMMUNITY_Community 32|Community 32]]
- [[_COMMUNITY_Community 33|Community 33]]
- [[_COMMUNITY_Community 34|Community 34]]
- [[_COMMUNITY_Community 35|Community 35]]
- [[_COMMUNITY_Community 36|Community 36]]
- [[_COMMUNITY_Community 37|Community 37]]
- [[_COMMUNITY_Community 38|Community 38]]
- [[_COMMUNITY_Community 39|Community 39]]
- [[_COMMUNITY_Community 40|Community 40]]
- [[_COMMUNITY_Community 41|Community 41]]
- [[_COMMUNITY_Community 42|Community 42]]
- [[_COMMUNITY_Community 43|Community 43]]
- [[_COMMUNITY_Community 44|Community 44]]
- [[_COMMUNITY_Community 45|Community 45]]
- [[_COMMUNITY_Community 46|Community 46]]
- [[_COMMUNITY_Community 48|Community 48]]
- [[_COMMUNITY_Community 49|Community 49]]
- [[_COMMUNITY_Community 50|Community 50]]
- [[_COMMUNITY_Community 52|Community 52]]
- [[_COMMUNITY_Community 53|Community 53]]
- [[_COMMUNITY_Community 54|Community 54]]
- [[_COMMUNITY_Community 55|Community 55]]
- [[_COMMUNITY_Community 56|Community 56]]
- [[_COMMUNITY_Community 58|Community 58]]
- [[_COMMUNITY_Community 60|Community 60]]
- [[_COMMUNITY_Community 61|Community 61]]
- [[_COMMUNITY_Community 64|Community 64]]
- [[_COMMUNITY_Community 65|Community 65]]
- [[_COMMUNITY_Community 69|Community 69]]
- [[_COMMUNITY_Community 70|Community 70]]

## God Nodes (most connected - your core abstractions)
1. `normalizePrefix()` - 145 edges
2. `parse()` - 140 edges
3. `parseWebhookEvent()` - 102 edges
4. `mapProviderStatus()` - 102 edges
5. `normalizeActionInput()` - 101 edges
6. `verifyWebhookSignature()` - 101 edges
7. `createProviderAdapter()` - 101 edges
8. `normalizeIdentifier()` - 92 edges
9. `replace()` - 74 edges
10. `requireFile()` - 58 edges

## Surprising Connections (you probably didn't know these)
- `normalize()` --calls--> `slugify()`  [INFERRED]
  admin-panel/src/admin-primitives/QueryBuilder.tsx → plugins/gutu-plugin-collab-pages-core/framework/builtin-plugins/collab-pages-core/src/services/main.service.ts
- `getWorkflowTransition()` --calls--> `transitionWorkflowInstance()`  [INFERRED]
  gutu-core/framework/core/jobs/src/index.ts → plugins/gutu-plugin-workflow-core/framework/builtin-plugins/workflow-core/src/services/main.service.ts
- `parse()` --calls--> `chunkMatchesPolicy()`  [INFERRED]
  plugins/gutu-plugin-e-invoicing-core/scripts/docs-summary.mjs → libraries/gutu-lib-ai-memory/framework/libraries/ai-memory/src/index.ts
- `parse()` --calls--> `deserializeSavedView()`  [INFERRED]
  plugins/gutu-plugin-e-invoicing-core/scripts/docs-summary.mjs → libraries/gutu-lib-admin-listview/framework/libraries/admin-listview/src/index.ts
- `parse()` --calls--> `createFormDefaults()`  [INFERRED]
  plugins/gutu-plugin-e-invoicing-core/scripts/docs-summary.mjs → libraries/gutu-lib-ui-form/framework/libraries/ui-form/src/index.ts

## Communities

### Community 0 - "Community 0"
Cohesion: 0.01
Nodes (257): ActiveRunsWidget(), AutomationInboxPage(), acknowledgeRunnerHandoff(), AgentBudgetExceededError, AgentReplayMismatchError, AgentToolDeniedError, appendAgentStep(), approveCheckpoint() (+249 more)

### Community 1 - "Community 1"
Cohesion: 0.01
Nodes (72): fetchAll(), applyEncryption(), bufferUpTo(), concat(), fromS3StorageClass(), nodeToWebStream(), S3StorageAdapter, toS3StorageClass() (+64 more)

### Community 2 - "Community 2"
Cohesion: 0.01
Nodes (133): bankAccounts(), bankTransactions(), budgets(), costCenters(), count(), currencyRates(), dunning(), fiscalYears() (+125 more)

### Community 3 - "Community 3"
Cohesion: 0.02
Nodes (133): contextUser(), isRecord(), normalizeEvent(), sanitizeJson(), loadPersonalization(), saveEdit(), savePersonalization(), countBadges() (+125 more)

### Community 4 - "Community 4"
Cohesion: 0.02
Nodes (124): importRuntimeModule(), loadAffineRuntime(), registerAffineEditorContainer(), all(), asRecord(), bodyJson(), createSimple(), findExplore() (+116 more)

### Community 5 - "Community 5"
Cohesion: 0.01
Nodes (76): addLeaf(), emit(), emptyLeaf(), isLeaf(), removeAt(), updateAt(), BlockSuitePageAdapter, loadBlockSuite() (+68 more)

### Community 6 - "Community 6"
Cohesion: 0.02
Nodes (116): canLaunchZone(), canRunAction(), canSeeField(), canSeeWidget(), canUseBuilder(), canUseCommand(), canViewPage(), canViewReport() (+108 more)

### Community 7 - "Community 7"
Cohesion: 0.02
Nodes (132): buildAccountingCoreMigrationSql(), buildAccountingCoreRollbackSql(), buildAiAssistCoreMigrationSql(), buildAiAssistCoreRollbackSql(), buildAnalyticsBiCoreMigrationSql(), buildAnalyticsBiCoreRollbackSql(), buildAssetsCoreMigrationSql(), buildAssetsCoreRollbackSql() (+124 more)

### Community 8 - "Community 8"
Cohesion: 0.03
Nodes (119): buildAccountingCoreSqliteMigrationSql(), buildAccountingCoreSqliteRollbackSql(), buildAiAssistCoreSqliteMigrationSql(), buildAiAssistCoreSqliteRollbackSql(), buildAnalyticsBiCoreSqliteMigrationSql(), buildAnalyticsBiCoreSqliteRollbackSql(), buildAssetsCoreSqliteMigrationSql(), buildAssetsCoreSqliteRollbackSql() (+111 more)

### Community 9 - "Community 9"
Cohesion: 0.03
Nodes (121): checkCatalog(), checkPluginDocs(), main(), missingHeadings(), placeholderFailures(), buildImportList(), capitalize(), createDocsCheckScript() (+113 more)

### Community 10 - "Community 10"
Cohesion: 0.03
Nodes (97): cmdCreate(), cmdHelp(), cmdList(), cmdValidate(), die(), exists(), findIndex(), log() (+89 more)

### Community 11 - "Community 11"
Cohesion: 0.03
Nodes (94): renderPrefix(), stripPrefix(), copyRequestId(), sanitizeForHeader(), actionRequiredExample(), buildProviderRecord(), classifySupportLevel(), countSeriousImplementedOperations() (+86 more)

### Community 12 - "Community 12"
Cohesion: 0.03
Nodes (70): createActivationEngine(), handleApply(), apiBase(), compileBiQuery(), createBiChart(), createBiDashboard(), createBiSchedule(), createBiShare() (+62 more)

### Community 13 - "Community 13"
Cohesion: 0.03
Nodes (4): amendRecord(), placeRecordOnHold(), releaseRecordHold(), reverseRecord()

### Community 14 - "Community 14"
Cohesion: 0.02
Nodes (2): createGeneratedProviderAdapter(), createProviderAdapter()

### Community 15 - "Community 15"
Cohesion: 0.04
Nodes (2): parseWebhookEvent(), verifyWebhookSignature()

### Community 16 - "Community 16"
Cohesion: 0.02
Nodes (1): mapProviderStatus()

### Community 17 - "Community 17"
Cohesion: 0.03
Nodes (61): AdminInner(), AppShell(), useLiveAudit(), AutomationRunDetailPage(), BookingDashboardKpis(), pct(), useRuntime(), addNote() (+53 more)

### Community 18 - "Community 18"
Cohesion: 0.03
Nodes (37): AdvancedDataTable(), AgentBuilderPage(), AvatarGroup(), BarChart(), Calendar(), formatRel(), FreshnessIndicator(), toMillis() (+29 more)

### Community 19 - "Community 19"
Cohesion: 0.05
Nodes (78): main(), read_cell_value(), read_shared_strings(), buildDependencyContractsFromLists(), dedupeList(), deriveSuggestedPackIds(), main(), renderActions() (+70 more)

### Community 20 - "Community 20"
Cohesion: 0.05
Nodes (49): handler(), AiProviderError, convertZodSchema(), createErrorResponse(), createMcpRuntimeOrchestrator(), createMcpRuntimeServer(), createMcpServerFromContracts(), createSchemaCacheEntry() (+41 more)

### Community 21 - "Community 21"
Cohesion: 0.07
Nodes (19): existsFile(), LocalStorageAdapter, exists(), findAdminPluginRoots(), walk(), collectStream(), fromAsyncIterable(), fromChunk() (+11 more)

### Community 22 - "Community 22"
Cohesion: 0.1
Nodes (3): checkPlaceholders(), requireFile(), requireHeadings()

### Community 23 - "Community 23"
Cohesion: 0.08
Nodes (49): createPaymentIdempotencyKey(), metricCard(), PaymentsOverviewAdminPage(), PaymentsProvidersAdminPage(), PaymentsRecordsAdminPage(), PaymentsRefundsAdminPage(), PaymentsWebhooksAdminPage(), renderMetricGrid() (+41 more)

### Community 24 - "Community 24"
Cohesion: 0.11
Nodes (37): envEnum(), envFlag(), envInt(), loadConfig(), resetConfig(), dbx(), fetch(), open() (+29 more)

### Community 25 - "Community 25"
Cohesion: 0.08
Nodes (36): ErrorBoundary, compileDraft(), compileEmailDraft(), createCommunicationIdempotencyKey(), createLocalCommunicationProviderRegistry(), createRetryDecision(), defineCommunicationRoute(), defineInAppCompiler() (+28 more)

### Community 26 - "Community 26"
Cohesion: 0.06
Nodes (24): buildDomainPlugin(), buildResource(), detailViewFromZod(), if(), formViewFromZod(), humanize(), inferField(), unwrap() (+16 more)

### Community 27 - "Community 27"
Cohesion: 0.06
Nodes (16): AnalyticsEmitterImpl, createAnalytics(), ensureSessionId(), createRuntime(), cryptoId(), CapabilityRegistryImpl, createCapabilityRegistry(), createFeatureFlags() (+8 more)

### Community 28 - "Community 28"
Cohesion: 0.09
Nodes (30): localWarehouseAdapter(), applyFilters(), applySorts(), clampLimit(), clone(), compareValues(), compileMetricQuerySql(), createChartVersion() (+22 more)

### Community 29 - "Community 29"
Cohesion: 0.1
Nodes (31): checkRegressionGate(), compareEvalRuns(), createEvalBaseline(), roundMetric(), runEvalDataset(), AiEvalsAdminPage(), buildEvalRunId(), captureEvalBaseline() (+23 more)

### Community 30 - "Community 30"
Cohesion: 0.09
Nodes (26): factory(), main(), renderMarkdownReport(), tailLines(), writeReports(), assertRevisionMismatch(), buildAdvanceInput(), buildCreateInput() (+18 more)

### Community 31 - "Community 31"
Cohesion: 0.15
Nodes (32): assertAuditHealthy(), assertCertificationHealthy(), assertConsumerSmokeHealthy(), copyCoreRoot(), copyRepoRoots(), createAuditReport(), createFileLockEntry(), discoverCorePackageIds() (+24 more)

### Community 32 - "Community 32"
Cohesion: 0.12
Nodes (26): advances(), appraisals(), attendance(), count(), departments(), designations(), employees(), expenseClaims() (+18 more)

### Community 33 - "Community 33"
Cohesion: 0.08
Nodes (1): seedState()

### Community 34 - "Community 34"
Cohesion: 0.08
Nodes (1): BusinessAdminPage()

### Community 35 - "Community 35"
Cohesion: 0.17
Nodes (18): createNavigationContract(), findMatchingZone(), isPathPrefixMatch(), listDeepLinks(), matchesRoutePattern(), matchesZone(), normalizeHref(), resolveNavigationTarget() (+10 more)

### Community 36 - "Community 36"
Cohesion: 0.17
Nodes (9): AccessDenied, ChecksumMismatch, InvalidKey, isRetryableByDefault(), isStorageError(), ObjectNotFound, PayloadTooLarge, StorageError (+1 more)

### Community 37 - "Community 37"
Cohesion: 0.16
Nodes (3): emptySummary(), sanitizeFilename(), validateCreateInput()

### Community 38 - "Community 38"
Cohesion: 0.22
Nodes (13): buildPluginContext(), CapabilityError, makeAnalytics(), makeAssetResolver(), makeContributions(), makeI18n(), makeLogger(), makePermissionGate() (+5 more)

### Community 39 - "Community 39"
Cohesion: 0.13
Nodes (5): fmt(), formatValue(), cn(), fmt(), fmt()

### Community 40 - "Community 40"
Cohesion: 0.15
Nodes (6): ConfigurationError, NotSupportedError, PaymentError, ProviderError, TransportError, WebhookVerificationError

### Community 41 - "Community 41"
Cohesion: 0.21
Nodes (5): createEventEnvelope(), createEventIdempotencyKey(), createOutboxRecord(), emitAuditEvent(), recordAuditEvent()

### Community 42 - "Community 42"
Cohesion: 0.24
Nodes (4): explorePathForQuery(), parseQueryState(), queryFromHash(), serializeQueryState()

### Community 43 - "Community 43"
Cohesion: 0.22
Nodes (2): createShellQueryScope(), invalidateShellDeskQueries()

### Community 44 - "Community 44"
Cohesion: 0.43
Nodes (7): createPlatformTableOptions(), createPlatformTableState(), setPlatformColumnVisibility(), setPlatformFilter(), setPlatformSorting(), togglePlatformRowSelection(), usePlatformTable()

### Community 45 - "Community 45"
Cohesion: 0.32
Nodes (3): assertCoordinates(), calculateBoundingBox(), haversineDistanceKm()

### Community 46 - "Community 46"
Cohesion: 0.52
Nodes (6): globRoots(), listStandaloneRoots(), listTrackedOffenders(), listVisibleStandaloneStatus(), runGit(), safeList()

### Community 48 - "Community 48"
Cohesion: 0.43
Nodes (5): filterCommandPaletteItems(), groupCommandPaletteItems(), normalizeQuery(), PlatformCommandPalette(), rankCommandPaletteItems()

### Community 49 - "Community 49"
Cohesion: 0.33
Nodes (1): PluginBoundary

### Community 50 - "Community 50"
Cohesion: 0.33
Nodes (1): App()

### Community 52 - "Community 52"
Cohesion: 0.47
Nodes (3): getTheme(), setTheme(), toggleTheme()

### Community 53 - "Community 53"
Cohesion: 0.4
Nodes (2): createSplitWorkspaceFixture(), hasDirectorySymlinkSupport()

### Community 54 - "Community 54"
Cohesion: 0.6
Nodes (5): AdminShell(), getReactRuntime(), PortalShell(), ShellFrame(), SiteShell()

### Community 55 - "Community 55"
Cohesion: 0.47
Nodes (4): createAdminEditorPreset(), createReadOnlyEditorPreset(), ReadOnlyEditorRenderer(), renderReadOnlyEditorContent()

### Community 56 - "Community 56"
Cohesion: 0.5
Nodes (2): post(), setPosts()

### Community 58 - "Community 58"
Cohesion: 0.6
Nodes (3): addMoney(), sameCurrency(), subtractMoney()

### Community 60 - "Community 60"
Cohesion: 0.67
Nodes (2): attachRpcHandler(), spawnIframeSandbox()

### Community 61 - "Community 61"
Cohesion: 0.67
Nodes (2): attachWorkerRpc(), spawnWorkerSandbox()

### Community 64 - "Community 64"
Cohesion: 0.83
Nodes (3): createPlatformEditorConfig(), createPlatformEditorExtensions(), usePlatformEditor()

### Community 65 - "Community 65"
Cohesion: 1.0
Nodes (2): isSecretKey(), scrubConfig()

### Community 69 - "Community 69"
Cohesion: 1.0
Nodes (2): NavIcon(), toPascal()

### Community 70 - "Community 70"
Cohesion: 0.67
Nodes (1): activate()

## Knowledge Gaps
- **Thin community `Community 14`** (103 nodes): `createGeneratedProviderAdapter()`, `createProviderAdapter()`, `adapter.ts`, `adapter.ts`, `adapter.ts`, `adapter.ts`, `adapter.ts`, `adapter.ts`, `adapter.ts`, `adapter.ts`, `adapter.ts`, `adapter.ts`, `adapter.ts`, `adapter.ts`, `adapter.ts`, `adapter.ts`, `adapter.ts`, `adapter.ts`, `adapter.ts`, `adapter.ts`, `adapter.ts`, `adapter.ts`, `adapter.ts`, `adapter.ts`, `adapter.ts`, `adapter.ts`, `adapter.ts`, `adapter.ts`, `adapter.ts`, `adapter.ts`, `adapter.ts`, `adapter.ts`, `adapter.ts`, `adapter.ts`, `adapter.ts`, `adapter.ts`, `adapter.ts`, `adapter.ts`, `adapter.ts`, `adapter.ts`, `adapter.ts`, `adapter.ts`, `adapter.ts`, `adapter.ts`, `adapter.ts`, `adapter.ts`, `adapter.ts`, `adapter.ts`, `adapter.ts`, `adapter.ts`, `adapter.ts`, `adapter.ts`, `adapter.ts`, `adapter.ts`, `adapter.ts`, `adapter.ts`, `adapter.ts`, `adapter.ts`, `adapter.ts`, `adapter.ts`, `adapter.ts`, `adapter.ts`, `adapter.ts`, `adapter.ts`, `adapter.ts`, `adapter.ts`, `adapter.ts`, `adapter.ts`, `adapter.ts`, `adapter.ts`, `adapter.ts`, `adapter.ts`, `adapter.ts`, `adapter.ts`, `adapter.ts`, `adapter.ts`, `adapter.ts`, `adapter.ts`, `adapter.ts`, `adapter.ts`, `adapter.ts`, `adapter.ts`, `adapter.ts`, `adapter.ts`, `adapter.ts`, `adapter.ts`, `adapter.ts`, `adapter.ts`, `adapter.ts`, `adapter.ts`, `adapter.ts`, `adapter.ts`, `adapter.ts`, `adapter.ts`, `adapter.ts`, `adapter.ts`, `adapter.ts`, `adapter.ts`, `adapter.ts`, `adapter.ts`, `adapter.ts`, `adapter.ts`, `adapter.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 15`** (102 nodes): `webhooks.ts`, `webhooks.ts`, `webhooks.ts`, `webhooks.ts`, `webhooks.ts`, `webhooks.ts`, `webhooks.ts`, `webhooks.ts`, `webhooks.ts`, `webhooks.ts`, `webhooks.ts`, `webhooks.ts`, `webhooks.ts`, `webhooks.ts`, `webhooks.ts`, `webhooks.ts`, `webhooks.ts`, `webhooks.ts`, `webhooks.ts`, `webhooks.ts`, `webhooks.ts`, `webhooks.ts`, `webhooks.ts`, `webhooks.ts`, `webhooks.ts`, `webhooks.ts`, `webhooks.ts`, `webhooks.ts`, `webhooks.ts`, `webhooks.ts`, `webhooks.ts`, `webhooks.ts`, `webhooks.ts`, `webhooks.ts`, `webhooks.ts`, `webhooks.ts`, `webhooks.ts`, `webhooks.ts`, `webhooks.ts`, `webhooks.ts`, `webhooks.ts`, `webhooks.ts`, `webhooks.ts`, `webhooks.ts`, `webhooks.ts`, `webhooks.ts`, `webhooks.ts`, `webhooks.ts`, `webhooks.ts`, `webhooks.ts`, `webhooks.ts`, `webhooks.ts`, `webhooks.ts`, `webhooks.ts`, `webhooks.ts`, `webhooks.ts`, `webhooks.ts`, `webhooks.ts`, `webhooks.ts`, `webhooks.ts`, `webhooks.ts`, `webhooks.ts`, `webhooks.ts`, `webhooks.ts`, `webhooks.ts`, `webhooks.ts`, `webhooks.ts`, `webhooks.ts`, `webhooks.ts`, `webhooks.ts`, `webhooks.ts`, `webhooks.ts`, `webhooks.ts`, `webhooks.ts`, `webhooks.ts`, `webhooks.ts`, `webhooks.ts`, `webhooks.ts`, `webhooks.ts`, `webhooks.ts`, `webhooks.ts`, `webhooks.ts`, `webhooks.ts`, `webhooks.ts`, `webhooks.ts`, `webhooks.ts`, `webhooks.ts`, `webhooks.ts`, `webhooks.ts`, `webhooks.ts`, `webhooks.ts`, `webhooks.ts`, `webhooks.ts`, `webhooks.ts`, `webhooks.ts`, `webhooks.ts`, `webhooks.ts`, `webhooks.ts`, `webhooks.ts`, `webhooks.ts`, `parseWebhookEvent()`, `verifyWebhookSignature()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 16`** (101 nodes): `mappers.ts`, `mappers.ts`, `mappers.ts`, `mappers.ts`, `mappers.ts`, `mappers.ts`, `mappers.ts`, `mappers.ts`, `mappers.ts`, `mappers.ts`, `mappers.ts`, `mappers.ts`, `mappers.ts`, `mappers.ts`, `mappers.ts`, `mappers.ts`, `mappers.ts`, `mappers.ts`, `mappers.ts`, `mappers.ts`, `mappers.ts`, `mappers.ts`, `mappers.ts`, `mappers.ts`, `mappers.ts`, `mappers.ts`, `mappers.ts`, `mappers.ts`, `mappers.ts`, `mappers.ts`, `mappers.ts`, `mappers.ts`, `mappers.ts`, `mappers.ts`, `mappers.ts`, `mappers.ts`, `mappers.ts`, `mappers.ts`, `mappers.ts`, `mappers.ts`, `mappers.ts`, `mappers.ts`, `mappers.ts`, `mappers.ts`, `mappers.ts`, `mappers.ts`, `mappers.ts`, `mappers.ts`, `mappers.ts`, `mappers.ts`, `mappers.ts`, `mappers.ts`, `mappers.ts`, `mappers.ts`, `mappers.ts`, `mappers.ts`, `mappers.ts`, `mappers.ts`, `mappers.ts`, `mappers.ts`, `mappers.ts`, `mappers.ts`, `mappers.ts`, `mappers.ts`, `mappers.ts`, `mappers.ts`, `mappers.ts`, `mappers.ts`, `mappers.ts`, `mappers.ts`, `mappers.ts`, `mappers.ts`, `mappers.ts`, `mappers.ts`, `mappers.ts`, `mappers.ts`, `mappers.ts`, `mappers.ts`, `mappers.ts`, `mappers.ts`, `mappers.ts`, `mappers.ts`, `mappers.ts`, `mappers.ts`, `mappers.ts`, `mappers.ts`, `mappers.ts`, `mappers.ts`, `mappers.ts`, `mappers.ts`, `mappers.ts`, `mappers.ts`, `mappers.ts`, `mappers.ts`, `mappers.ts`, `mappers.ts`, `mappers.ts`, `mappers.ts`, `mappers.ts`, `mappers.ts`, `mapProviderStatus()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 33`** (26 nodes): `seedState()`, `main.service.ts`, `main.service.ts`, `main.service.ts`, `main.service.ts`, `main.service.ts`, `main.service.ts`, `main.service.ts`, `main.service.ts`, `main.service.ts`, `main.service.ts`, `main.service.ts`, `main.service.ts`, `main.service.ts`, `main.service.ts`, `main.service.ts`, `main.service.ts`, `main.service.ts`, `main.service.ts`, `main.service.ts`, `main.service.ts`, `main.service.ts`, `main.service.ts`, `main.service.ts`, `main.service.ts`, `main.service.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 34`** (26 nodes): `BusinessAdminPage()`, `main.page.tsx`, `main.page.tsx`, `main.page.tsx`, `main.page.tsx`, `main.page.tsx`, `main.page.tsx`, `main.page.tsx`, `main.page.tsx`, `main.page.tsx`, `main.page.tsx`, `main.page.tsx`, `main.page.tsx`, `main.page.tsx`, `main.page.tsx`, `main.page.tsx`, `main.page.tsx`, `main.page.tsx`, `main.page.tsx`, `main.page.tsx`, `main.page.tsx`, `main.page.tsx`, `main.page.tsx`, `main.page.tsx`, `main.page.tsx`, `main.page.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 43`** (10 nodes): `createPlatformQueryClient()`, `createPlatformQueryKey()`, `createShellQueryScope()`, `invalidatePlatformScopes()`, `invalidateShellDeskQueries()`, `primePlatformQuery()`, `resetTenantScopedQueries()`, `usePlatformMutation()`, `usePlatformQuery()`, `index.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 49`** (6 nodes): `PluginBoundary.tsx`, `DefaultFallback()`, `PluginBoundary`, `.componentDidCatch()`, `.getDerivedStateFromError()`, `.render()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 50`** (6 nodes): `App.tsx`, `App()`, `App.tsx`, `App.tsx`, `App.tsx`, `App.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 53`** (6 nodes): `package.test.ts`, `package.test.ts`, `createFrameworkSourceFixture()`, `createIo()`, `createSplitWorkspaceFixture()`, `hasDirectorySymlinkSupport()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 56`** (5 nodes): `community-pages.tsx`, `action()`, `on()`, `post()`, `setPosts()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 60`** (4 nodes): `iframeSandbox.tsx`, `attachRpcHandler()`, `dispatchRpc()`, `spawnIframeSandbox()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 61`** (4 nodes): `workerSandbox.ts`, `attachWorkerRpc()`, `dispatchWorkerRpc()`, `spawnWorkerSandbox()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 65`** (3 nodes): `storage.ts`, `isSecretKey()`, `scrubConfig()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 69`** (3 nodes): `NavIcon.tsx`, `NavIcon()`, `toPascal()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 70`** (3 nodes): `plugin.tsx`, `plugin.tsx`, `activate()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `replace()` connect `Community 11` to `Community 0`, `Community 1`, `Community 2`, `Community 3`, `Community 5`, `Community 6`, `Community 9`, `Community 10`, `Community 12`, `Community 17`, `Community 19`, `Community 20`, `Community 21`, `Community 22`, `Community 24`, `Community 26`, `Community 28`, `Community 29`, `Community 30`, `Community 31`, `Community 32`, `Community 37`, `Community 38`?**
  _High betweenness centrality (0.072) - this node is a cross-community bridge._
- **Why does `parse()` connect `Community 3` to `Community 0`, `Community 4`, `Community 5`, `Community 6`, `Community 9`, `Community 42`, `Community 10`, `Community 12`, `Community 11`, `Community 14`, `Community 18`, `Community 20`, `Community 21`, `Community 23`, `Community 26`, `Community 27`, `Community 28`, `Community 31`?**
  _High betweenness centrality (0.041) - this node is a cross-community bridge._
- **Why does `seedAll()` connect `Community 2` to `Community 32`, `Community 1`, `Community 4`, `Community 9`, `Community 10`?**
  _High betweenness centrality (0.026) - this node is a cross-community bridge._
- **Are the 83 inferred relationships involving `parse()` (e.g. with `readGutuPlugins()` and `parseStorageBackendsEnv()`) actually correct?**
  _`parse()` has 83 INFERRED edges - model-reasoned connections that need verification._
- **Are the 2 inferred relationships involving `parseWebhookEvent()` (e.g. with `ingestWebhookEvent()` and `parseGenericWebhookEvent()`) actually correct?**
  _`parseWebhookEvent()` has 2 INFERRED edges - model-reasoned connections that need verification._
- **Are the 2 inferred relationships involving `mapProviderStatus()` (e.g. with `.get()` and `.get()`) actually correct?**
  _`mapProviderStatus()` has 2 INFERRED edges - model-reasoned connections that need verification._
- **Are the 99 inferred relationships involving `normalizeActionInput()` (e.g. with `parse()` and `publishBusinessMessage()`) actually correct?**
  _`normalizeActionInput()` has 99 INFERRED edges - model-reasoned connections that need verification._