import { defineWorkflow } from "@platform/jobs";

export const workflowDefinitionKeys = ["access-review", "content-publication", "invoice-approval"] as const;

export const workflowDefinitions = {
  "access-review": defineWorkflow({
    id: "access-review",
    description: "Review and grant sensitive access only after security review.",
    businessPurpose: "Protect privileged access changes with explicit security approval and revocation paths.",
    actors: ["requester", "security-reviewer", "admin"],
    invariants: [
      "Access cannot be granted without a security review.",
      "Granted access must remain revocable."
    ],
    mandatorySteps: [
      "Every access request starts in draft and must be submitted for review before approval.",
      "Revocation must remain available after a grant."
    ],
    stateDescriptions: {
      draft: {
        description: "The access request is being prepared by the requester."
      },
      security_review: {
        description: "Security is evaluating the request and its risk posture."
      },
      granted: {
        description: "Access has been granted and is actively in force."
      },
      rejected: {
        description: "The request was denied and may be reopened for correction."
      },
      revoked: {
        description: "Previously granted access has been removed."
      }
    },
    transitionDescriptions: {
      "draft.submit": "Sends the request into security review.",
      "security_review.approve": "Grants the access after review.",
      "security_review.reject": "Rejects the request and closes the review cycle.",
      "granted.revoke": "Removes access after it has been granted.",
      "rejected.reopen": "Returns the request to draft for correction and resubmission."
    },
    initialState: "draft",
    states: {
      draft: { on: { submit: "security_review" } },
      security_review: { on: { approve: "granted", reject: "rejected" } },
      granted: { on: { revoke: "revoked" } },
      rejected: { on: { reopen: "draft" } },
      revoked: {}
    }
  }),
  "content-publication": defineWorkflow({
    id: "content-publication",
    description: "Editorial review and publication workflow for governed content.",
    businessPurpose: "Prevent content from reaching publication without editorial review and scheduled release control.",
    actors: ["author", "editor", "publisher"],
    invariants: [
      "Published content must pass through editor review.",
      "Archived content cannot be republished without reopening."
    ],
    mandatorySteps: [
      "Draft content must be submitted for editor review.",
      "Scheduled content must pass through publish before becoming live."
    ],
    stateDescriptions: {
      draft: {
        description: "Content is being prepared by the author."
      },
      editor_review: {
        description: "Editors are checking readiness, accuracy, and compliance."
      },
      scheduled: {
        description: "Content is approved and waiting for publication."
      },
      published: {
        description: "Content is live and visible to the intended audience."
      },
      rejected: {
        description: "Editorial review failed and the content must be revised."
      },
      archived: {
        description: "Content is no longer active but remains in history."
      }
    },
    transitionDescriptions: {
      "draft.submit": "Moves the draft into editorial review.",
      "editor_review.approve": "Approves content for scheduling.",
      "editor_review.reject": "Rejects content for revision.",
      "scheduled.publish": "Publishes approved content.",
      "published.archive": "Archives live content.",
      "rejected.reopen": "Returns rejected content to draft."
    },
    initialState: "draft",
    states: {
      draft: { on: { submit: "editor_review" } },
      editor_review: { on: { approve: "scheduled", reject: "rejected" } },
      scheduled: { on: { publish: "published" } },
      published: { on: { archive: "archived" } },
      rejected: { on: { reopen: "draft" } },
      archived: {}
    }
  }),
  "invoice-approval": defineWorkflow({
    id: "invoice-approval",
    description: "Finance approval flow for invoices before they are finalized.",
    businessPurpose: "Ensure invoices are reviewed before final approval and archival.",
    actors: ["requester", "approver", "finance-admin"],
    invariants: [
      "Invoices cannot move to approved without a pending approval state.",
      "Rejected invoices must reopen before resubmission."
    ],
    mandatorySteps: [
      "Invoice drafts must be submitted before approvers can act.",
      "Only approved invoices may be archived."
    ],
    stateDescriptions: {
      draft: {
        description: "Invoice is being prepared and has not yet entered approval."
      },
      pending_approval: {
        description: "Invoice is waiting for finance approval."
      },
      approved: {
        description: "Invoice has been approved and is ready for finalization."
      },
      rejected: {
        description: "Invoice was rejected and must be corrected."
      },
      archived: {
        description: "Invoice has been finalized and archived."
      }
    },
    transitionDescriptions: {
      "draft.submit": "Queues the invoice for approval.",
      "pending_approval.approve": "Approves the invoice for finalization.",
      "pending_approval.reject": "Rejects the invoice for correction.",
      "approved.archive": "Archives the approved invoice.",
      "rejected.reopen": "Returns the invoice to draft."
    },
    initialState: "draft",
    states: {
      draft: { on: { submit: "pending_approval" } },
      pending_approval: { on: { approve: "approved", reject: "rejected" } },
      approved: { on: { archive: "archived" } },
      rejected: { on: { reopen: "draft" } },
      archived: {}
    }
  })
} as const;

export type WorkflowDefinitionKey = (typeof workflowDefinitionKeys)[number];
