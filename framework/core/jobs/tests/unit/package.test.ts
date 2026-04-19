import { describe, expect, it } from "bun:test";
import { z } from "zod";

import {
  calculateRetryDelay,
  createInMemoryJobQueueAdapter,
  createJobRegistry,
  createRetryPolicy,
  defineJob,
  defineWorkflow,
  getWorkflowTransition,
  packageId
} from "../../src";

describe("jobs", () => {
  it("exposes a stable package id", () => {
    expect(packageId).toBe("jobs");
  });

  it("computes workflow transitions", () => {
    const workflow = defineWorkflow({
      id: "booking.confirmation",
      description: "Approval flow that turns a draft booking into a confirmed reservation.",
      businessPurpose: "Prevent bookings from being confirmed before review is complete.",
      mandatorySteps: ["A draft booking must be submitted before approval."],
      stateDescriptions: {
        draft: {
          description: "Booking captured but not yet submitted for review."
        },
        pending: {
          description: "Booking is waiting for approval."
        },
        confirmed: {
          description: "Booking is approved and operationally active."
        }
      },
      transitionDescriptions: {
        "draft.submit": "Moves the booking into a review queue.",
        "pending.approve": "Commits the booking as confirmed."
      },
      initialState: "draft",
      states: {
        draft: {
          on: {
            submit: "pending"
          }
        },
        pending: {
          on: {
            approve: "confirmed"
          }
        },
        confirmed: {}
      }
    });

    expect(getWorkflowTransition(workflow, "draft", "submit")).toBe("pending");
    expect(getWorkflowTransition(workflow, "confirmed", "approve")).toBeNull();
    expect(workflow.description).toBe("Approval flow that turns a draft booking into a confirmed reservation.");
    expect(workflow.transitionDescriptions?.["draft.submit"]).toBe("Moves the booking into a review queue.");
  });

  it("dispatches queued jobs and deduplicates repeated payloads", async () => {
    const registry = createJobRegistry([
      defineJob({
        id: "crm.sync",
        queue: "sync",
        payload: z.object({
          contactId: z.string()
        }),
        dedupeKey: (payload) => payload.contactId,
        handler: () => undefined
      })
    ]);
    const adapter = createInMemoryJobQueueAdapter();

    const first = await registry.dispatch(adapter, {
      jobDefinitionId: "crm.sync",
      payload: {
        contactId: "contact-1"
      }
    });
    const second = await registry.dispatch(adapter, {
      jobDefinitionId: "crm.sync",
      payload: {
        contactId: "contact-1"
      }
    });

    expect(first.status).toBe("queued");
    expect(second.status).toBe("deduplicated");
    expect(adapter.enqueued).toHaveLength(1);
  });

  it("returns retry and dead-letter outcomes from the job runner", async () => {
    const registry = createJobRegistry([
      defineJob({
        id: "notifications.send",
        queue: "notifications",
        payload: z.object({
          notificationId: z.string()
        }),
        retryPolicy: createRetryPolicy({
          attempts: 2,
          delayMs: 250,
          backoff: "fixed"
        }),
        handler: () => {
          throw new Error("provider unavailable");
        }
      })
    ]);

    const firstAttempt = await registry.run({
      jobId: "job-1",
      jobDefinitionId: "notifications.send",
      queue: "notifications",
      payload: {
        notificationId: "notice-1"
      }
    });
    const secondAttempt = await registry.run(
      {
        jobId: "job-1",
        jobDefinitionId: "notifications.send",
        queue: "notifications",
        payload: {
          notificationId: "notice-1"
        }
      },
      2
    );

    expect(firstAttempt).toMatchObject({
      status: "retry",
      nextDelayMs: 250
    });
    expect(secondAttempt).toMatchObject({
      status: "dead-letter",
      deadLetter: {
        error: "provider unavailable"
      }
    });
  });

  it("calculates exponential retry windows", () => {
    expect(
      calculateRetryDelay(
        createRetryPolicy({
          attempts: 4,
          backoff: "exponential",
          delayMs: 100,
          maxDelayMs: 250
        }),
        3
      )
    ).toBe(250);
  });

  it("deduplicates reentrant dispatches triggered from a running job handler", async () => {
    const adapter = createInMemoryJobQueueAdapter();
    const registry = createJobRegistry();
    let reentrantDispatchStatus: string | undefined;

    registry.register(
      defineJob({
        id: "crm.sync",
        queue: "sync",
        payload: z.object({
          contactId: z.string()
        }),
        dedupeKey: (payload) => payload.contactId,
        handler: async ({ payload }) => {
          const reentrant = await registry.dispatch(adapter, {
            jobDefinitionId: "crm.sync",
            payload
          });
          reentrantDispatchStatus = reentrant.status;
        }
      })
    );

    const first = await registry.dispatch(adapter, {
      jobDefinitionId: "crm.sync",
      payload: {
        contactId: "contact-1"
      }
    });
    const envelope = adapter.enqueued[0];
    if (!envelope) {
      throw new Error("expected queued job envelope");
    }

    const result = await registry.run(envelope);

    expect(first.status).toBe("queued");
    expect(result.status).toBe("completed");
    expect(reentrantDispatchStatus).toBe("deduplicated");
    expect(adapter.enqueued).toHaveLength(1);
  });
});
