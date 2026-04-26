import type { FieldDescriptor } from "./fields";

export type ErpDocumentStatus = "draft" | "submitted" | "cancelled" | "closed" | string;

export interface ErpFieldDependency {
  readonly field: string;
  readonly operator?: "equals" | "not-equals" | "in" | "not-in" | "truthy" | "falsy";
  readonly value?: unknown;
}

export interface ErpLinkFilter {
  readonly field: string;
  readonly operator?: "equals" | "not-equals" | "in" | "not-in" | "like";
  readonly valueFrom?: string;
  readonly value?: unknown;
}

export interface ErpChildTableDefinition {
  readonly field: string;
  readonly label: string;
  readonly resourceId?: string;
  readonly minRows?: number;
  readonly maxRows?: number;
  readonly fields: readonly FieldDescriptor[];
  readonly itemField?: string;
  readonly quantityField?: string;
  readonly amountField?: string;
}

export interface ErpDocumentLinkDefinition {
  readonly field: string;
  readonly label?: string;
  readonly targetResourceId: string;
  readonly targetDocumentType?: string;
  readonly dynamicTargetField?: string;
  readonly reverseRelation?: string;
  readonly filters?: readonly ErpLinkFilter[];
}

export interface ErpDocumentMappingAction {
  readonly id: string;
  readonly label: string;
  readonly relation: string;
  readonly targetResourceId: string;
  readonly targetDocumentType?: string;
  readonly visibleInStatuses?: readonly ErpDocumentStatus[];
  readonly requiredPermission?: string;
  readonly fieldMap?: Readonly<Record<string, string>>;
  readonly childTableMap?: Readonly<Record<string, string>>;
  readonly defaults?: Readonly<Record<string, unknown>>;
}

export interface ErpPrintFormatDefinition {
  readonly id: string;
  readonly label: string;
  readonly default?: boolean;
  readonly paperSize?: "A4" | "Letter" | "Thermal" | string;
}

export interface ErpPortalSurfaceDefinition {
  readonly route: string;
  readonly audience: "customer" | "supplier" | "employee" | "partner" | "public";
  readonly enabledByDefault?: boolean;
}

export interface ErpWorkspaceLinkDefinition {
  readonly label: string;
  readonly path: string;
  readonly kind: "document" | "report" | "page" | "setup" | "builder" | "portal";
  readonly group?: string;
  readonly description?: string;
}

export interface ErpTreeDefinition {
  readonly parentField: string;
  readonly labelField?: string;
  readonly rootLabel?: string;
}

export interface ErpWorkflowTransitionDefinition {
  readonly from: ErpDocumentStatus;
  readonly to: ErpDocumentStatus;
  readonly label: string;
  readonly requiredPermission?: string;
  readonly reasonRequired?: boolean;
}

export interface ErpWorkflowDefinition {
  readonly stateField: string;
  readonly initialState: ErpDocumentStatus;
  readonly terminalStates?: readonly ErpDocumentStatus[];
  readonly transitions: readonly ErpWorkflowTransitionDefinition[];
}

export interface ErpPropertySetterDefinition {
  readonly field: string;
  readonly property:
    | "label"
    | "required"
    | "readonly"
    | "hidden"
    | "printHidden"
    | "portalHidden"
    | "defaultValue"
    | "options"
    | "section";
  readonly value: unknown;
  readonly scope?: "tenant" | "company" | "role" | "pack";
}

export interface ErpDashboardChartDefinition {
  readonly id: string;
  readonly label: string;
  readonly resourceId: string;
  readonly type: "bar" | "line" | "area" | "donut" | "number" | "table";
  readonly groupBy?: string;
  readonly measure?: string;
  readonly filter?: Record<string, unknown>;
}

export interface ErpNumberCardDefinition {
  readonly id: string;
  readonly label: string;
  readonly resourceId: string;
  readonly measure?: "count" | "sum" | "avg" | "min" | "max";
  readonly field?: string;
  readonly filter?: Record<string, unknown>;
  readonly warnAbove?: number;
  readonly warnBelow?: number;
}

export interface ErpBuilderSurfaceDefinition {
  readonly id: string;
  readonly label: string;
  readonly kind:
    | "doctype"
    | "child-table"
    | "property-setter"
    | "workspace"
    | "print-format"
    | "web-form"
    | "portal-page"
    | "workflow"
    | "report"
    | "tree"
    | "naming-series"
    | "number-card"
    | "dashboard-chart"
    | "form-tour"
    | "onboarding"
    | "pack";
  readonly path: string;
  readonly exportableToPack?: boolean;
}

export interface ErpResourceMetadata {
  readonly documentType?: string;
  readonly module?: string;
  readonly namingSeries?: string;
  readonly statusField?: string;
  readonly submittedStatuses?: readonly ErpDocumentStatus[];
  readonly titleField?: string;
  readonly searchFields?: readonly string[];
  readonly tabs?: readonly {
    readonly id: string;
    readonly label: string;
    readonly fields?: readonly string[];
  }[];
  readonly sections?: readonly {
    readonly id: string;
    readonly label: string;
    readonly columns?: 1 | 2 | 3;
    readonly fields?: readonly string[];
  }[];
  readonly childTables?: readonly ErpChildTableDefinition[];
  readonly links?: readonly ErpDocumentLinkDefinition[];
  readonly mappingActions?: readonly ErpDocumentMappingAction[];
  readonly workflow?: ErpWorkflowDefinition;
  readonly tree?: ErpTreeDefinition;
  readonly propertySetters?: readonly ErpPropertySetterDefinition[];
  readonly workspaceLinks?: readonly ErpWorkspaceLinkDefinition[];
  readonly dashboardCharts?: readonly ErpDashboardChartDefinition[];
  readonly numberCards?: readonly ErpNumberCardDefinition[];
  readonly builderSurfaces?: readonly ErpBuilderSurfaceDefinition[];
  readonly printFormats?: readonly ErpPrintFormatDefinition[];
  readonly portal?: ErpPortalSurfaceDefinition;
  readonly onboardingSteps?: readonly string[];
}

export function defineErpResourceMetadata<T extends ErpResourceMetadata>(metadata: T): Readonly<T> {
  return Object.freeze({
    ...metadata,
    tabs: Object.freeze([...(metadata.tabs ?? [])]),
    sections: Object.freeze([...(metadata.sections ?? [])]),
    childTables: Object.freeze([...(metadata.childTables ?? [])]),
    links: Object.freeze([...(metadata.links ?? [])]),
    mappingActions: Object.freeze([...(metadata.mappingActions ?? [])]),
    propertySetters: Object.freeze([...(metadata.propertySetters ?? [])]),
    workspaceLinks: Object.freeze([...(metadata.workspaceLinks ?? [])]),
    dashboardCharts: Object.freeze([...(metadata.dashboardCharts ?? [])]),
    numberCards: Object.freeze([...(metadata.numberCards ?? [])]),
    builderSurfaces: Object.freeze([...(metadata.builderSurfaces ?? [])]),
    printFormats: Object.freeze([...(metadata.printFormats ?? [])]),
    onboardingSteps: Object.freeze([...(metadata.onboardingSteps ?? [])])
  });
}
