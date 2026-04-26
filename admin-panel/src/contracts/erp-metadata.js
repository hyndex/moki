export function defineErpResourceMetadata(metadata) {
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
