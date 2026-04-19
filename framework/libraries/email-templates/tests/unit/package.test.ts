import { describe, expect, it } from "bun:test";
import React from "react";

import {
  createEmailTemplateRegistry,
  defineEmailTemplate,
  packageId,
  renderEmailTemplate
} from "../../src";

describe("email-templates", () => {
  it("exposes a stable package id", () => {
    expect(packageId).toBe("email-templates");
  });

  it("renders html and text from registered templates", async () => {
    const template = defineEmailTemplate({
      id: "notifications.welcome",
      from: "hello@platform.test",
      replyTo: "support@platform.test",
      previewText: "Welcome aboard",
      subject: ({ name }: { name: string }) => `Welcome ${name}`,
      component: ({ name }: { name: string }) =>
        React.createElement("div", null, React.createElement("h1", null, `Welcome ${name}`))
    });
    const registry = createEmailTemplateRegistry([template]);

    const rendered = await registry.render("notifications.welcome", {
      name: "Ada"
    });

    expect(rendered.subject).toBe("Welcome Ada");
    expect(rendered.from).toBe("hello@platform.test");
    expect(rendered.html).toContain("Welcome Ada");
    expect(rendered.text.toLowerCase()).toContain("welcome ada");
  });

  it("supports direct preview rendering helpers", async () => {
    const template = defineEmailTemplate({
      id: "notifications.preview",
      from: "hello@platform.test",
      subject: () => "Preview",
      component: () => React.createElement("div", null, "Preview body")
    });

    const rendered = await renderEmailTemplate(template, {});
    expect(rendered.templateId).toBe("notifications.preview");
    expect(rendered.text).toContain("Preview body");
  });
});
