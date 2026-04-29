# Graph Report - Framework  (2026-04-29)

## Corpus Check
- 4187 files · ~6,937,209 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 9672 nodes · 15025 edges · 81 communities detected
- Extraction: 69% EXTRACTED · 31% INFERRED · 0% AMBIGUOUS · INFERRED: 4693 edges (avg confidence: 0.8)
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
- [[_COMMUNITY_Community 47|Community 47]]
- [[_COMMUNITY_Community 48|Community 48]]
- [[_COMMUNITY_Community 49|Community 49]]
- [[_COMMUNITY_Community 50|Community 50]]
- [[_COMMUNITY_Community 51|Community 51]]
- [[_COMMUNITY_Community 52|Community 52]]
- [[_COMMUNITY_Community 53|Community 53]]
- [[_COMMUNITY_Community 54|Community 54]]
- [[_COMMUNITY_Community 55|Community 55]]
- [[_COMMUNITY_Community 56|Community 56]]
- [[_COMMUNITY_Community 58|Community 58]]
- [[_COMMUNITY_Community 59|Community 59]]
- [[_COMMUNITY_Community 60|Community 60]]
- [[_COMMUNITY_Community 61|Community 61]]
- [[_COMMUNITY_Community 62|Community 62]]
- [[_COMMUNITY_Community 63|Community 63]]
- [[_COMMUNITY_Community 64|Community 64]]
- [[_COMMUNITY_Community 65|Community 65]]
- [[_COMMUNITY_Community 66|Community 66]]
- [[_COMMUNITY_Community 69|Community 69]]
- [[_COMMUNITY_Community 70|Community 70]]
- [[_COMMUNITY_Community 71|Community 71]]
- [[_COMMUNITY_Community 72|Community 72]]
- [[_COMMUNITY_Community 75|Community 75]]
- [[_COMMUNITY_Community 78|Community 78]]
- [[_COMMUNITY_Community 79|Community 79]]
- [[_COMMUNITY_Community 80|Community 80]]
- [[_COMMUNITY_Community 81|Community 81]]
- [[_COMMUNITY_Community 84|Community 84]]
- [[_COMMUNITY_Community 85|Community 85]]
- [[_COMMUNITY_Community 86|Community 86]]
- [[_COMMUNITY_Community 88|Community 88]]
- [[_COMMUNITY_Community 89|Community 89]]
- [[_COMMUNITY_Community 91|Community 91]]

## God Nodes (most connected - your core abstractions)
1. `String()` - 253 edges
2. `parse()` - 234 edges
3. `replace()` - 203 edges
4. `normalizePrefix()` - 145 edges
5. `set()` - 128 edges
6. `all()` - 127 edges
7. `nowIso()` - 121 edges
8. `normalizeActionInput()` - 114 edges
9. `useEffect()` - 103 edges
10. `parseWebhookEvent()` - 102 edges

## Surprising Connections (you probably didn't know these)
- `money()` --calls--> `round()`  [INFERRED]
  admin-panel/backend/src/seed/helpers.ts → plugins/gutu-plugin-erp-actions-core/framework/builtin-plugins/erp-actions-core/src/host-plugin/routes/erp-actions.ts
- `money()` --calls--> `round()`  [INFERRED]
  admin-panel/backend/src/seed/manufacturing-extended.ts → plugins/gutu-plugin-erp-actions-core/framework/builtin-plugins/erp-actions-core/src/host-plugin/routes/erp-actions.ts
- `money()` --calls--> `round()`  [INFERRED]
  admin-panel/backend/src/seed/procurement-extended.ts → plugins/gutu-plugin-erp-actions-core/framework/builtin-plugins/erp-actions-core/src/host-plugin/routes/erp-actions.ts
- `money()` --calls--> `round()`  [INFERRED]
  admin-panel/backend/src/seed/accounting-extended.ts → plugins/gutu-plugin-erp-actions-core/framework/builtin-plugins/erp-actions-core/src/host-plugin/routes/erp-actions.ts
- `lifecycleSnapshot()` --calls--> `round()`  [INFERRED]
  admin-panel/backend/src/host/lifecycle.ts → plugins/gutu-plugin-erp-actions-core/framework/builtin-plugins/erp-actions-core/src/host-plugin/routes/erp-actions.ts

## Communities

### Community 0 - "Community 0"
Cohesion: 0.01
Nodes (542): accessibleRecordIds(), effectiveRole(), grantAcl(), listAcl(), purgeAclForRecord(), revokeAcl(), roleAtLeast(), roleFromLinkToken() (+534 more)

### Community 1 - "Community 1"
Cohesion: 0.01
Nodes (254): canLaunchZone(), canRunAction(), canSeeField(), canSeeWidget(), canUseBuilder(), canUseCommand(), canViewPage(), canViewReport() (+246 more)

### Community 2 - "Community 2"
Cohesion: 0.01
Nodes (343): cloneAccount(), cloneEntry(), clonePeriod(), createErpAccountingRuntime(), daysBetween(), defaultNormalBalance(), defineErpAccount(), signedAmount() (+335 more)

### Community 3 - "Community 3"
Cohesion: 0.01
Nodes (225): decodeEncodedWords(), formatAddress(), formatAddresses(), normalizeEmail(), normalizeSubject(), parseAddress(), parseAddressList(), participantsHash() (+217 more)

### Community 4 - "Community 4"
Cohesion: 0.01
Nodes (206): runOrError(), safeJson(), apiBase(), createEditorRecord(), createPublicLink(), deleteEditorRecord(), fetchEditorRecord(), fetchSnapshot() (+198 more)

### Community 5 - "Community 5"
Cohesion: 0.01
Nodes (141): AdvancedDataTable(), loadState(), addLeaf(), AdvancedFilterBuilder(), emit(), emptyLeaf(), isLeaf(), removeAt() (+133 more)

### Community 6 - "Community 6"
Cohesion: 0.01
Nodes (146): AdminInner(), AdminRoot(), PermissionsRoot(), PlaygroundUI(), AIInsightPanel(), AppShell(), buildCrumbs(), ExternalViewRenderer() (+138 more)

### Community 7 - "Community 7"
Cohesion: 0.01
Nodes (188): findAdminPluginRoots(), walk(), apiBase(), authHeaders(), autoMap(), commit(), onFile(), onPaste() (+180 more)

### Community 8 - "Community 8"
Cohesion: 0.01
Nodes (157): fetchAll(), monthKey(), num(), str(), aggregate(), bucketKey(), computeAggregation(), evalFilter() (+149 more)

### Community 9 - "Community 9"
Cohesion: 0.02
Nodes (132): exists(), isRecord(), normalizeEvent(), sanitizeJson(), asSeries(), countBadges(), parse(), assertRepositoryBoundary() (+124 more)

### Community 10 - "Community 10"
Cohesion: 0.02
Nodes (139): fmtCurrency(), mockKpis(), mockSeries(), fmtCurrency(), mockKpis(), mockSeries(), AiEvalsRunDetailPage(), ExecutiveDashboard() (+131 more)

### Community 11 - "Community 11"
Cohesion: 0.02
Nodes (135): bankAccounts(), bankTransactions(), budgets(), code(), costCenters(), count(), currencyRates(), dunning() (+127 more)

### Community 12 - "Community 12"
Cohesion: 0.03
Nodes (78): applyEncryption(), bufferUpTo(), concat(), existsFile(), fromS3StorageClass(), LocalStorageAdapter, nodeToWebStream(), renderPrefix() (+70 more)

### Community 13 - "Community 13"
Cohesion: 0.03
Nodes (136): normaliseDate(), checkCatalog(), checkPluginDocs(), main(), missingHeadings(), placeholderFailures(), buildImportList(), capitalize() (+128 more)

### Community 14 - "Community 14"
Cohesion: 0.02
Nodes (132): buildAccountingCoreMigrationSql(), buildAccountingCoreRollbackSql(), buildAiAssistCoreMigrationSql(), buildAiAssistCoreRollbackSql(), buildAnalyticsBiCoreMigrationSql(), buildAnalyticsBiCoreRollbackSql(), buildAssetsCoreMigrationSql(), buildAssetsCoreRollbackSql() (+124 more)

### Community 15 - "Community 15"
Cohesion: 0.02
Nodes (77): buildViews(), buildCompactControlRoom(), buildControlRoom(), formViewFromZod(), humanize(), inferField(), unwrap(), zodKind() (+69 more)

### Community 16 - "Community 16"
Cohesion: 0.03
Nodes (119): buildAccountingCoreSqliteMigrationSql(), buildAccountingCoreSqliteRollbackSql(), buildAiAssistCoreSqliteMigrationSql(), buildAiAssistCoreSqliteRollbackSql(), buildAnalyticsBiCoreSqliteMigrationSql(), buildAnalyticsBiCoreSqliteRollbackSql(), buildAssetsCoreSqliteMigrationSql(), buildAssetsCoreSqliteRollbackSql() (+111 more)

### Community 17 - "Community 17"
Cohesion: 0.03
Nodes (86): compileBiQuery(), createBiChart(), createBiDashboard(), createBiSchedule(), createBiShare(), createBiSpace(), drillDownBiQuery(), fetchBiCatalog() (+78 more)

### Community 18 - "Community 18"
Cohesion: 0.04
Nodes (9): assertUnsupportedOperation(), normalizeWebhookStatus(), parseGenericWebhookEvent(), readRecordField(), readStatusField(), readStringField(), safeJsonParse(), parseWebhookEvent() (+1 more)

### Community 19 - "Community 19"
Cohesion: 0.03
Nodes (4): amendRecord(), placeRecordOnHold(), releaseRecordHold(), reverseRecord()

### Community 20 - "Community 20"
Cohesion: 0.02
Nodes (2): createGeneratedProviderAdapter(), createProviderAdapter()

### Community 21 - "Community 21"
Cohesion: 0.02
Nodes (1): mapProviderStatus()

### Community 22 - "Community 22"
Cohesion: 0.04
Nodes (84): track(), untrack(), canonicalise(), hashArgs(), purgeExpired(), store(), buildCartesianChartOption(), ChartSurface() (+76 more)

### Community 23 - "Community 23"
Cohesion: 0.06
Nodes (79): discoverPluginSpecs(), fromEnv(), fromMonorepo(), fromPackageJson(), loadDiscoveredPlugins(), readPackageJson(), api(), login() (+71 more)

### Community 24 - "Community 24"
Cohesion: 0.05
Nodes (77): main(), runScenario(), buildDependencyContractsFromLists(), dedupeList(), deriveSuggestedPackIds(), main(), renderActions(), renderAdminContributions() (+69 more)

### Community 25 - "Community 25"
Cohesion: 0.05
Nodes (18): main(), read_cell_value(), read_shared_strings(), asAttachment(), ImageDetail(), onKey(), ImapClient, ImapError (+10 more)

### Community 26 - "Community 26"
Cohesion: 0.05
Nodes (58): accountingImbalance(), assertSafeJson(), buildErpDocumentRender(), buildErpPostingReport(), buildMappedTargetRecord(), cloneJson(), collectPrintableRecord(), escapeHtml() (+50 more)

### Community 27 - "Community 27"
Cohesion: 0.06
Nodes (47): envEnum(), envFlag(), envInt(), loadConfig(), resetConfig(), t(), dbx(), drainMiddleware() (+39 more)

### Community 28 - "Community 28"
Cohesion: 0.05
Nodes (60): copyRequestId(), actionRequiredExample(), buildProviderRecord(), classifySupportLevel(), countSeriousImplementedOperations(), createFirstWaveReadinessReport(), createSupportMatrix(), deriveAdvertisedCapabilities() (+52 more)

### Community 29 - "Community 29"
Cohesion: 0.09
Nodes (3): checkPlaceholders(), requireFile(), requireHeadings()

### Community 30 - "Community 30"
Cohesion: 0.08
Nodes (49): createPaymentIdempotencyKey(), metricCard(), PaymentsOverviewAdminPage(), PaymentsProvidersAdminPage(), PaymentsRecordsAdminPage(), PaymentsRefundsAdminPage(), PaymentsWebhooksAdminPage(), renderMetricGrid() (+41 more)

### Community 31 - "Community 31"
Cohesion: 0.06
Nodes (43): buildRestrictedPreviewScenario(), buildWorkbenchHref(), createAdminRegistry(), createWorkbenchCustomization(), featureLinksForProfile(), parseCookie(), resolveProfile(), resolveWorkbenchDensity() (+35 more)

### Community 32 - "Community 32"
Cohesion: 0.09
Nodes (32): api(), login(), main(), record(), safe(), scenarioAuthGuards(), scenarioCrudEdges(), scenarioDiscovery() (+24 more)

### Community 33 - "Community 33"
Cohesion: 0.13
Nodes (37): aggregateMetric(), aggregateSnapshots(), applyFilters(), applySorts(), clampLimit(), clone(), compareValues(), compileMetricQuerySql() (+29 more)

### Community 34 - "Community 34"
Cohesion: 0.11
Nodes (33): compileDraft(), compileEmailDraft(), createCommunicationIdempotencyKey(), createLocalCommunicationProviderRegistry(), createRetryDecision(), defineCommunicationRoute(), defineInAppCompiler(), definePushCompiler() (+25 more)

### Community 35 - "Community 35"
Cohesion: 0.11
Nodes (24): buildPluginContext(), CapabilityError, createContributionStore(), makeAnalytics(), makeAssetResolver(), makeContributions(), makeI18n(), makeLogger() (+16 more)

### Community 36 - "Community 36"
Cohesion: 0.1
Nodes (24): applyStructuredFilter(), bufferToFloat32(), buildPostgresTsQuery(), createSearchResultPage(), escapeRegExp(), magnitude(), normalizeSearchQuery(), runFts() (+16 more)

### Community 37 - "Community 37"
Cohesion: 0.12
Nodes (27): advances(), appraisals(), attendance(), code(), count(), departments(), designations(), employees() (+19 more)

### Community 38 - "Community 38"
Cohesion: 0.08
Nodes (1): BusinessAdminPage()

### Community 39 - "Community 39"
Cohesion: 0.08
Nodes (1): seedState()

### Community 40 - "Community 40"
Cohesion: 0.17
Nodes (18): createNavigationContract(), findMatchingZone(), isPathPrefixMatch(), listDeepLinks(), matchesRoutePattern(), matchesZone(), normalizeHref(), resolveNavigationTarget() (+10 more)

### Community 41 - "Community 41"
Cohesion: 0.16
Nodes (3): emptySummary(), sanitizeFilename(), validateCreateInput()

### Community 42 - "Community 42"
Cohesion: 0.17
Nodes (9): AccessDenied, ChecksumMismatch, InvalidKey, isRetryableByDefault(), isStorageError(), ObjectNotFound, PayloadTooLarge, StorageError (+1 more)

### Community 43 - "Community 43"
Cohesion: 0.2
Nodes (14): cannedResponses(), code(), count(), csatResponses(), escalations(), kbArticles(), personName(), pick() (+6 more)

### Community 44 - "Community 44"
Cohesion: 0.19
Nodes (13): handleApply(), FrameEditor(), handler(), postToParent(), buildAdvanceInput(), buildCreateInput(), buildReconcileInput(), loadPluginModule() (+5 more)

### Community 45 - "Community 45"
Cohesion: 0.23
Nodes (14): withLeadership(), cronMatches(), ensureRunsTable(), fieldMatches(), getScheduleRunsForTest(), listTimeBasedRules(), recordsWithDateField(), runSchedulerTickForTest() (+6 more)

### Community 46 - "Community 46"
Cohesion: 0.27
Nodes (10): handleInstall(), remove(), addTrustedKey(), base64ToBytes(), computeSRI384(), loadTrustedKeys(), removeTrustedKey(), saveTrustedKeys() (+2 more)

### Community 47 - "Community 47"
Cohesion: 0.22
Nodes (7): Toolbar(), ToolbarButton(), createPermissionEvaluator(), evalCondition(), evalLeaf(), PermissionEvaluatorImpl, ruleApplies()

### Community 48 - "Community 48"
Cohesion: 0.18
Nodes (7): computeBounds(), LineSeries(), project(), yFor(), buildBomTree(), expandAll(), buildTreeFromFlat()

### Community 49 - "Community 49"
Cohesion: 0.15
Nodes (6): ConfigurationError, NotSupportedError, PaymentError, ProviderError, TransportError, WebhookVerificationError

### Community 50 - "Community 50"
Cohesion: 0.36
Nodes (7): getPluginUiRecord(), installPluginUiIfNeeded(), readInstalled(), runIsolated(), startPluginUi(), stopPluginUi(), writeInstalled()

### Community 51 - "Community 51"
Cohesion: 0.43
Nodes (7): createPlatformTableOptions(), createPlatformTableState(), setPlatformColumnVisibility(), setPlatformFilter(), setPlatformSorting(), togglePlatformRowSelection(), usePlatformTable()

### Community 52 - "Community 52"
Cohesion: 0.32
Nodes (3): assertCoordinates(), calculateBoundingBox(), haversineDistanceKm()

### Community 53 - "Community 53"
Cohesion: 0.33
Nodes (2): DefaultFallback(), PluginBoundary

### Community 54 - "Community 54"
Cohesion: 0.29
Nodes (1): App()

### Community 55 - "Community 55"
Cohesion: 0.48
Nodes (5): DocumentWorkspace(), PagesWorkspace(), SlidesWorkspace(), SpreadsheetWorkspace(), WhiteboardWorkspace()

### Community 56 - "Community 56"
Cohesion: 0.52
Nodes (6): globRoots(), listStandaloneRoots(), listTrackedOffenders(), listVisibleStandaloneStatus(), runGit(), safeList()

### Community 58 - "Community 58"
Cohesion: 0.43
Nodes (5): filterCommandPaletteItems(), groupCommandPaletteItems(), normalizeQuery(), PlatformCommandPalette(), rankCommandPaletteItems()

### Community 59 - "Community 59"
Cohesion: 0.53
Nodes (5): containsLookalike(), looksLikeBrandImpersonation(), parseAuthResults(), phishHeuristics(), splitMethods()

### Community 60 - "Community 60"
Cohesion: 0.33
Nodes (1): intent()

### Community 61 - "Community 61"
Cohesion: 0.4
Nodes (2): createSplitWorkspaceFixture(), hasDirectorySymlinkSupport()

### Community 62 - "Community 62"
Cohesion: 0.6
Nodes (5): AdminShell(), getReactRuntime(), PortalShell(), ShellFrame(), SiteShell()

### Community 63 - "Community 63"
Cohesion: 0.47
Nodes (4): createAdminEditorPreset(), createReadOnlyEditorPreset(), ReadOnlyEditorRenderer(), renderReadOnlyEditorContent()

### Community 64 - "Community 64"
Cohesion: 0.7
Nodes (3): attachWorkerRpc(), dispatchWorkerRpc(), spawnWorkerSandbox()

### Community 65 - "Community 65"
Cohesion: 0.4
Nodes (1): EditorErrorBoundary

### Community 66 - "Community 66"
Cohesion: 0.5
Nodes (2): post(), setPosts()

### Community 69 - "Community 69"
Cohesion: 0.6
Nodes (3): addMoney(), sameCurrency(), subtractMoney()

### Community 70 - "Community 70"
Cohesion: 0.67
Nodes (2): classifyIntent(), HealthMonitorWidget()

### Community 71 - "Community 71"
Cohesion: 0.83
Nodes (2): NavIcon(), toPascal()

### Community 72 - "Community 72"
Cohesion: 0.67
Nodes (2): hash(), initials()

### Community 75 - "Community 75"
Cohesion: 0.83
Nodes (3): consoleTelemetrySink(), httpBatchTelemetrySink(), installTelemetrySink()

### Community 78 - "Community 78"
Cohesion: 0.83
Nodes (3): createPlatformEditorConfig(), createPlatformEditorExtensions(), usePlatformEditor()

### Community 79 - "Community 79"
Cohesion: 1.0
Nodes (2): isSecretKey(), scrubConfig()

### Community 80 - "Community 80"
Cohesion: 1.0
Nodes (2): CronBuilder(), describe()

### Community 81 - "Community 81"
Cohesion: 0.67
Nodes (1): SpacerWidget()

### Community 84 - "Community 84"
Cohesion: 0.67
Nodes (1): defineErpResourceMetadata()

### Community 85 - "Community 85"
Cohesion: 0.67
Nodes (1): fieldServiceEvents()

### Community 86 - "Community 86"
Cohesion: 1.0
Nodes (2): mockKpis(), mockSeries()

### Community 88 - "Community 88"
Cohesion: 0.67
Nodes (1): activate()

### Community 89 - "Community 89"
Cohesion: 0.67
Nodes (1): bookingEvents()

### Community 91 - "Community 91"
Cohesion: 0.67
Nodes (1): cn()

## Knowledge Gaps
- **3 isolated node(s):** `GoogleAuthError`, `MicrosoftAuthError`, `AiQuotaError`
  These have ≤1 connection - possible missing edges or undocumented components.
- **Thin community `Community 20`** (103 nodes): `createGeneratedProviderAdapter()`, `createProviderAdapter()`, `adapter.ts`, `adapter.ts`, `adapter.ts`, `adapter.ts`, `adapter.ts`, `adapter.ts`, `adapter.ts`, `adapter.ts`, `adapter.ts`, `adapter.ts`, `adapter.ts`, `adapter.ts`, `adapter.ts`, `adapter.ts`, `adapter.ts`, `adapter.ts`, `adapter.ts`, `adapter.ts`, `adapter.ts`, `adapter.ts`, `adapter.ts`, `adapter.ts`, `adapter.ts`, `adapter.ts`, `adapter.ts`, `adapter.ts`, `adapter.ts`, `adapter.ts`, `adapter.ts`, `adapter.ts`, `adapter.ts`, `adapter.ts`, `adapter.ts`, `adapter.ts`, `adapter.ts`, `adapter.ts`, `adapter.ts`, `adapter.ts`, `adapter.ts`, `adapter.ts`, `adapter.ts`, `adapter.ts`, `adapter.ts`, `adapter.ts`, `adapter.ts`, `adapter.ts`, `adapter.ts`, `adapter.ts`, `adapter.ts`, `adapter.ts`, `adapter.ts`, `adapter.ts`, `adapter.ts`, `adapter.ts`, `adapter.ts`, `adapter.ts`, `adapter.ts`, `adapter.ts`, `adapter.ts`, `adapter.ts`, `adapter.ts`, `adapter.ts`, `adapter.ts`, `adapter.ts`, `adapter.ts`, `adapter.ts`, `adapter.ts`, `adapter.ts`, `adapter.ts`, `adapter.ts`, `adapter.ts`, `adapter.ts`, `adapter.ts`, `adapter.ts`, `adapter.ts`, `adapter.ts`, `adapter.ts`, `adapter.ts`, `adapter.ts`, `adapter.ts`, `adapter.ts`, `adapter.ts`, `adapter.ts`, `adapter.ts`, `adapter.ts`, `adapter.ts`, `adapter.ts`, `adapter.ts`, `adapter.ts`, `adapter.ts`, `adapter.ts`, `adapter.ts`, `adapter.ts`, `adapter.ts`, `adapter.ts`, `adapter.ts`, `adapter.ts`, `adapter.ts`, `adapter.ts`, `adapter.ts`, `adapter.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 21`** (101 nodes): `mappers.ts`, `mappers.ts`, `mappers.ts`, `mappers.ts`, `mappers.ts`, `mappers.ts`, `mappers.ts`, `mappers.ts`, `mappers.ts`, `mappers.ts`, `mappers.ts`, `mappers.ts`, `mappers.ts`, `mappers.ts`, `mappers.ts`, `mappers.ts`, `mappers.ts`, `mappers.ts`, `mappers.ts`, `mappers.ts`, `mappers.ts`, `mappers.ts`, `mappers.ts`, `mappers.ts`, `mappers.ts`, `mappers.ts`, `mappers.ts`, `mappers.ts`, `mappers.ts`, `mappers.ts`, `mappers.ts`, `mappers.ts`, `mappers.ts`, `mappers.ts`, `mappers.ts`, `mappers.ts`, `mappers.ts`, `mappers.ts`, `mappers.ts`, `mappers.ts`, `mappers.ts`, `mappers.ts`, `mappers.ts`, `mappers.ts`, `mappers.ts`, `mappers.ts`, `mappers.ts`, `mappers.ts`, `mappers.ts`, `mappers.ts`, `mappers.ts`, `mappers.ts`, `mappers.ts`, `mappers.ts`, `mappers.ts`, `mappers.ts`, `mappers.ts`, `mappers.ts`, `mappers.ts`, `mappers.ts`, `mappers.ts`, `mappers.ts`, `mappers.ts`, `mappers.ts`, `mappers.ts`, `mappers.ts`, `mappers.ts`, `mappers.ts`, `mappers.ts`, `mappers.ts`, `mappers.ts`, `mappers.ts`, `mappers.ts`, `mappers.ts`, `mappers.ts`, `mappers.ts`, `mappers.ts`, `mappers.ts`, `mappers.ts`, `mappers.ts`, `mappers.ts`, `mappers.ts`, `mappers.ts`, `mappers.ts`, `mappers.ts`, `mappers.ts`, `mappers.ts`, `mappers.ts`, `mappers.ts`, `mappers.ts`, `mappers.ts`, `mappers.ts`, `mappers.ts`, `mappers.ts`, `mappers.ts`, `mappers.ts`, `mappers.ts`, `mappers.ts`, `mappers.ts`, `mappers.ts`, `mapProviderStatus()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 38`** (26 nodes): `BusinessAdminPage()`, `main.page.tsx`, `main.page.tsx`, `main.page.tsx`, `main.page.tsx`, `main.page.tsx`, `main.page.tsx`, `main.page.tsx`, `main.page.tsx`, `main.page.tsx`, `main.page.tsx`, `main.page.tsx`, `main.page.tsx`, `main.page.tsx`, `main.page.tsx`, `main.page.tsx`, `main.page.tsx`, `main.page.tsx`, `main.page.tsx`, `main.page.tsx`, `main.page.tsx`, `main.page.tsx`, `main.page.tsx`, `main.page.tsx`, `main.page.tsx`, `main.page.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 39`** (26 nodes): `seedState()`, `main.service.ts`, `main.service.ts`, `main.service.ts`, `main.service.ts`, `main.service.ts`, `main.service.ts`, `main.service.ts`, `main.service.ts`, `main.service.ts`, `main.service.ts`, `main.service.ts`, `main.service.ts`, `main.service.ts`, `main.service.ts`, `main.service.ts`, `main.service.ts`, `main.service.ts`, `main.service.ts`, `main.service.ts`, `main.service.ts`, `main.service.ts`, `main.service.ts`, `main.service.ts`, `main.service.ts`, `main.service.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 53`** (7 nodes): `PluginBoundary.js`, `PluginBoundary.tsx`, `DefaultFallback()`, `PluginBoundary`, `.componentDidCatch()`, `.getDerivedStateFromError()`, `.render()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 54`** (7 nodes): `App.js`, `App.tsx`, `App()`, `App.tsx`, `App.tsx`, `App.tsx`, `App.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 60`** (6 nodes): `ApprovalPanel.js`, `ApprovalPanel.tsx`, `ApprovalPanel()`, `handleApprove()`, `handleReject()`, `intent()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 61`** (6 nodes): `package.test.ts`, `package.test.ts`, `createFrameworkSourceFixture()`, `createIo()`, `createSplitWorkspaceFixture()`, `hasDirectorySymlinkSupport()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 65`** (5 nodes): `EditorErrorBoundary.js`, `EditorErrorBoundary`, `.componentDidCatch()`, `.getDerivedStateFromError()`, `.render()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 66`** (5 nodes): `community-pages.tsx`, `action()`, `on()`, `post()`, `setPosts()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 70`** (4 nodes): `HealthMonitorWidget.js`, `HealthMonitorWidget.tsx`, `classifyIntent()`, `HealthMonitorWidget()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 71`** (4 nodes): `NavIcon.js`, `NavIcon.tsx`, `NavIcon()`, `toPascal()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 72`** (4 nodes): `Avatar.js`, `Avatar.tsx`, `hash()`, `initials()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 79`** (3 nodes): `storage.ts`, `isSecretKey()`, `scrubConfig()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 80`** (3 nodes): `CronBuilder.tsx`, `CronBuilder()`, `describe()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 81`** (3 nodes): `SpacerWidget.js`, `SpacerWidget.tsx`, `SpacerWidget()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 84`** (3 nodes): `erp-metadata.js`, `erp-metadata.ts`, `defineErpResourceMetadata()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 85`** (3 nodes): `field-service-pages.js`, `field-service-pages.tsx`, `fieldServiceEvents()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 86`** (3 nodes): `hr-payroll-archetype.tsx`, `mockKpis()`, `mockSeries()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 88`** (3 nodes): `plugin.tsx`, `plugin.tsx`, `activate()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 89`** (3 nodes): `BookingCalendarPage.js`, `BookingCalendarPage.tsx`, `bookingEvents()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 91`** (3 nodes): `cn.js`, `cn.ts`, `cn()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `String()` connect `Community 7` to `Community 0`, `Community 1`, `Community 2`, `Community 3`, `Community 4`, `Community 5`, `Community 6`, `Community 8`, `Community 9`, `Community 10`, `Community 11`, `Community 12`, `Community 13`, `Community 15`, `Community 17`, `Community 18`, `Community 20`, `Community 22`, `Community 23`, `Community 25`, `Community 26`, `Community 28`, `Community 30`, `Community 32`, `Community 33`, `Community 37`, `Community 43`, `Community 44`, `Community 46`, `Community 50`?**
  _High betweenness centrality (0.118) - this node is a cross-community bridge._
- **Why does `replace()` connect `Community 3` to `Community 0`, `Community 1`, `Community 2`, `Community 4`, `Community 5`, `Community 6`, `Community 7`, `Community 9`, `Community 10`, `Community 11`, `Community 12`, `Community 13`, `Community 15`, `Community 17`, `Community 22`, `Community 23`, `Community 24`, `Community 25`, `Community 26`, `Community 27`, `Community 28`, `Community 29`, `Community 31`, `Community 32`, `Community 33`, `Community 35`, `Community 36`, `Community 37`, `Community 41`, `Community 44`, `Community 46`?**
  _High betweenness centrality (0.078) - this node is a cross-community bridge._
- **Why does `parse()` connect `Community 9` to `Community 0`, `Community 1`, `Community 2`, `Community 3`, `Community 4`, `Community 5`, `Community 6`, `Community 7`, `Community 12`, `Community 13`, `Community 15`, `Community 17`, `Community 18`, `Community 20`, `Community 22`, `Community 23`, `Community 26`, `Community 28`, `Community 30`, `Community 32`, `Community 33`, `Community 45`, `Community 46`, `Community 50`?**
  _High betweenness centrality (0.074) - this node is a cross-community bridge._
- **Are the 252 inferred relationships involving `String()` (e.g. with `setup()` and `code()`) actually correct?**
  _`String()` has 252 INFERRED edges - model-reasoned connections that need verification._
- **Are the 169 inferred relationships involving `parse()` (e.g. with `readGutuPlugins()` and `migrate()`) actually correct?**
  _`parse()` has 169 INFERRED edges - model-reasoned connections that need verification._
- **Are the 201 inferred relationships involving `replace()` (e.g. with `personEmail()` and `personEmail()`) actually correct?**
  _`replace()` has 201 INFERRED edges - model-reasoned connections that need verification._
- **Are the 127 inferred relationships involving `set()` (e.g. with `authedFetch()` and `authedFetch()`) actually correct?**
  _`set()` has 127 INFERRED edges - model-reasoned connections that need verification._