import { defineResource } from "@platform/schema";
import { z } from "zod";
import { domainRecords } from "../../db/schema";
import { workflowDefinitionKeys } from "../workflows/catalog";

export const WorkflowInstanceResource = defineResource({
  id: "workflow.instances",
  description: "Durable workflow instance record used to track approval and publication processes across the platform.",
  businessPurpose: "Give operators and automation a single governed view of every active or historical workflow instance.",
  invariants: [
    "Each workflow instance belongs to one tenant and one workflow definition.",
    "State transitions must remain auditable and replayable."
  ],
  lifecycleNotes: [
    "Instances move between explicit states only through declared transitions.",
    "Approval status and due dates drive operator queues and reminders."
  ],
  actors: ["requester", "approver", "admin"],
  table: domainRecords,
  contract: z.object({
    id: z.string().uuid(),
    tenantId: z.string().uuid(),
    definitionKey: z.enum(workflowDefinitionKeys),
    subjectType: z.enum(["invoice", "content", "access-request"]),
    subjectId: z.string().min(3),
    currentState: z.string().min(3),
    approvalStatus: z.enum(["not-required", "pending", "approved", "rejected"]),
    assignedRole: z.string().min(2).nullable(),
    dueAt: z.string().min(1).nullable(),
    lastTransitionAt: z.string().min(1).nullable(),
    createdAt: z.string()
  }),
  fields: {
    approvalStatus: {
      filter: "select",
      label: "Approval",
      description: "Current approval posture for the workflow instance.",
      businessMeaning: "Tells operators whether the instance is waiting on review or already resolved."
    },
    createdAt: {
      sortable: true,
      label: "Created",
      description: "Creation timestamp for the workflow instance.",
      businessMeaning: "Used for queue ordering, SLA measurement, and audit trails."
    },
    currentState: {
      filter: "select",
      label: "State",
      description: "Current workflow state for the instance.",
      businessMeaning: "Determines the next allowed transitions and visible operator actions.",
      requiredForFlows: ["workflow-review", "workflow-escalation"]
    },
    definitionKey: {
      searchable: true,
      sortable: true,
      label: "Workflow",
      description: "Workflow template that governs the instance.",
      businessMeaning: "Identifies which state machine and policy rules apply."
    },
    dueAt: {
      filter: "date",
      sortable: true,
      label: "Due",
      description: "Optional due date for the current review or approval step.",
      businessMeaning: "Supports escalation, reminders, and queue prioritization."
    },
    subjectType: {
      filter: "select",
      label: "Subject Type",
      description: "Domain object type that the workflow instance governs.",
      businessMeaning: "Helps operators understand whether the workflow is for content, invoices, or access requests."
    }
  },
  admin: {
    autoCrud: true,
    defaultColumns: ["definitionKey", "subjectType", "currentState", "approvalStatus", "dueAt", "createdAt"]
  },
  portal: { enabled: false }
});
