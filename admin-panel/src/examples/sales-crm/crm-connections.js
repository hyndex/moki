/** ConnectionsPanel descriptor for CRM records — surfaces related records
 *  on every detail page's right rail. Each item counts live (via
 *  useAggregation) and deep-links to a filtered list.
 *
 *  Wired on Contact detail pages; extendable to other resources via the
 *  plugin config's `connections` field or by passing directly to
 *  <ConnectionsPanel descriptor={crmContactConnections} parent={record} />.
 */
export const crmContactConnections = {
    parentResource: "crm.contact",
    categories: [
        {
            id: "sales",
            label: "Sales",
            items: [
                {
                    id: "opportunities",
                    label: "Opportunities",
                    resource: "crm.opportunity",
                    icon: "Target",
                    filter: (parent) => ({ field: "contactId", op: "eq", value: String(parent.id ?? "") }),
                    href: (parent) => `/crm/opportunities?filter[contactId]=${parent.id}`,
                },
                {
                    id: "appointments",
                    label: "Appointments",
                    resource: "crm.appointment",
                    icon: "Calendar",
                    filter: (parent) => ({ field: "contactId", op: "eq", value: String(parent.id ?? "") }),
                    href: (parent) => `/crm/appointments?filter[contactId]=${parent.id}`,
                },
                {
                    id: "contracts",
                    label: "Contracts",
                    resource: "crm.contract",
                    icon: "FileText",
                    filter: (parent) => ({ field: "contactId", op: "eq", value: String(parent.id ?? "") }),
                    href: (parent) => `/crm/contracts?filter[contactId]=${parent.id}`,
                },
            ],
        },
        {
            id: "finance",
            label: "Finance",
            items: [
                {
                    id: "invoices",
                    label: "Invoices",
                    resource: "accounting.invoice",
                    icon: "Receipt",
                    filter: (parent) => ({ field: "customer", op: "eq", value: String(parent.name ?? "") }),
                    href: (parent) => `/accounting/invoices?filter[customer]=${parent.name}`,
                },
                {
                    id: "payments",
                    label: "Payments",
                    resource: "payments.payment",
                    icon: "CreditCard",
                    filter: (parent) => ({ field: "customer", op: "eq", value: String(parent.name ?? "") }),
                    href: (parent) => `/finance/payments?filter[customer]=${parent.name}`,
                },
            ],
        },
        {
            id: "support",
            label: "Support",
            items: [
                {
                    id: "tickets",
                    label: "Tickets",
                    resource: "support-service.ticket",
                    icon: "LifeBuoy",
                    filter: (parent) => ({ field: "requester", op: "eq", value: String(parent.name ?? "") }),
                    href: (parent) => `/support/tickets?filter[requester]=${parent.name}`,
                },
            ],
        },
        {
            id: "engagement",
            label: "Engagement",
            items: [
                {
                    id: "notes",
                    label: "Notes",
                    resource: "crm.note",
                    icon: "StickyNote",
                    filter: (parent) => ({ field: "contactId", op: "eq", value: String(parent.id ?? "") }),
                },
                {
                    id: "activities",
                    label: "Activities",
                    resource: "crm.activity",
                    icon: "Activity",
                    filter: (parent) => ({ field: "contactId", op: "eq", value: String(parent.id ?? "") }),
                },
            ],
        },
    ],
};
export const crmOpportunityConnections = {
    parentResource: "crm.opportunity",
    categories: [
        {
            id: "lifecycle",
            label: "Lifecycle",
            items: [
                {
                    id: "appointments",
                    label: "Appointments",
                    resource: "crm.appointment",
                    icon: "Calendar",
                    filter: (parent) => ({ field: "opportunityId", op: "eq", value: String(parent.id ?? "") }),
                },
                {
                    id: "contracts",
                    label: "Contracts",
                    resource: "crm.contract",
                    icon: "FileText",
                    filter: (parent) => ({ field: "opportunityId", op: "eq", value: String(parent.id ?? "") }),
                },
                {
                    id: "quotes",
                    label: "Quotes",
                    resource: "sales.quote",
                    icon: "FileCheck",
                    filter: (parent) => ({ field: "opportunityId", op: "eq", value: String(parent.id ?? "") }),
                },
            ],
        },
    ],
};
export const crmCampaignConnections = {
    parentResource: "crm.campaign",
    categories: [
        {
            id: "results",
            label: "Results",
            items: [
                {
                    id: "leads",
                    label: "Leads generated",
                    resource: "crm.lead",
                    icon: "UserRound",
                    filter: (parent) => ({ field: "campaign", op: "eq", value: String(parent.id ?? "") }),
                    href: (parent) => `/crm/leads?filter[campaign]=${parent.id}`,
                },
                {
                    id: "opportunities",
                    label: "Opportunities generated",
                    resource: "crm.opportunity",
                    icon: "Target",
                    filter: (parent) => ({ field: "campaign", op: "eq", value: String(parent.id ?? "") }),
                    href: (parent) => `/crm/opportunities?filter[campaign]=${parent.id}`,
                },
            ],
        },
    ],
};
