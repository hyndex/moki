import type React from "react";
import { render, toPlainText } from "@react-email/render";

export const packageId = "email-templates" as const;
export const packageDisplayName = "Email Templates" as const;
export const packageDescription = "React Email wrapper and template helpers." as const;

export type RenderedEmail = {
  templateId: string;
  subject: string;
  from: string;
  replyTo?: string | undefined;
  html: string;
  text: string;
  previewText?: string | undefined;
};

export type EmailTemplateDefinition<TProps extends Record<string, unknown> = Record<string, unknown>> = {
  id: string;
  from: string;
  replyTo?: string | undefined;
  previewText?: string | undefined;
  subject(props: TProps): string;
  component(props: TProps): React.ReactElement;
};

export type EmailTemplateRegistry = {
  register<TProps extends Record<string, unknown>>(template: EmailTemplateDefinition<TProps>): EmailTemplateRegistry;
  render<TProps extends Record<string, unknown>>(templateId: string, props: TProps): Promise<RenderedEmail>;
  list(): string[];
};

export function defineEmailTemplate<TProps extends Record<string, unknown>>(
  template: EmailTemplateDefinition<TProps>
): EmailTemplateDefinition<TProps> {
  return Object.freeze(template);
}

export function createEmailTemplateRegistry(templates: EmailTemplateDefinition[] = []): EmailTemplateRegistry {
  const registry = new Map<string, EmailTemplateDefinition>();
  for (const template of templates) {
    registry.set(template.id, template);
  }

  return {
    register(template) {
      if (registry.has(template.id)) {
        throw new Error(`Email template '${template.id}' is already registered`);
      }
      registry.set(template.id, template);
      return this;
    },
    async render(templateId, props) {
      const template = registry.get(templateId);
      if (!template) {
        throw new Error(`Email template '${templateId}' is not registered`);
      }
      return renderEmailTemplate(template, props);
    },
    list() {
      return [...registry.keys()].sort((left, right) => left.localeCompare(right));
    }
  };
}

export async function renderEmailTemplate<TProps extends Record<string, unknown>>(
  template: EmailTemplateDefinition<TProps>,
  props: TProps
): Promise<RenderedEmail> {
  const html = await render(template.component(props));
  return Object.freeze({
    templateId: template.id,
    subject: template.subject(props),
    from: template.from,
    replyTo: template.replyTo,
    previewText: template.previewText,
    html,
    text: toPlainText(html)
  });
}

export async function renderEmailPreview<TProps extends Record<string, unknown>>(
  template: EmailTemplateDefinition<TProps>,
  props: TProps
): Promise<{ templateId: string; subject: string; html: string }> {
  const rendered = await renderEmailTemplate(template, props);
  return {
    templateId: rendered.templateId,
    subject: rendered.subject,
    html: rendered.html
  };
}
