/** Vendored copy of `TestAffineEditorContainer` from
 *  `ref/workspace/AFFiNE/blocksuite/integration-test/src/editors/editor-container.ts`.
 *
 *  Ported as-is (MIT, copyright toeverything) and re-registered as the
 *  `affine-editor-container` custom element so the AFFiNE block runtime
 *  has a host to render into.
 *
 *  The integration-test package isn't published to npm — this is the
 *  blessed-by-upstream way to embed BlockSuite outside the AFFiNE app
 *  itself; the AFFiNE web app's own editor host has a near-identical
 *  shape but uses React + Lit interop helpers we don't need here. */

import { computed, signal } from "@preact/signals-core";
import { css, html } from "lit";
import { keyed } from "lit/directives/keyed.js";
import { when } from "lit/directives/when.js";

type AffineDocMode = "page" | "edgeless";
type AffineStore = {
  root?: { id?: string };
  slots?: { rootAdded?: { subscribe: (handler: () => void) => unknown } };
};
type AffineBlockStdScope = {
  host?: unknown;
  render: () => unknown;
  get: (token: unknown) => {
    app$?: { value?: string };
    edgeless$?: { value?: string };
  };
};
type AffineRuntime = {
  BlockStdScope: new (options: { store: AffineStore; extensions: unknown[] }) => AffineBlockStdScope;
  ShadowlessElement: CustomElementConstructor;
  SignalWatcher: (base: CustomElementConstructor) => CustomElementConstructor;
  ThemeProvider: unknown;
  WithDisposable: (base: CustomElementConstructor) => CustomElementConstructor;
};

type GutuAffineEditorElement = HTMLElement & {
  doc: AffineStore;
  edgelessSpecs: unknown[];
  mode: AffineDocMode;
  pageSpecs: unknown[];
  updateComplete?: Promise<unknown>;
};

let registerPromise: Promise<void> | null = null;

async function importRuntimeModule(specifier: string): Promise<unknown> {
  const runtimeImport = new Function("specifier", "return import(specifier)") as (
    specifier: string,
  ) => Promise<unknown>;
  return runtimeImport(specifier);
}

async function loadAffineRuntime(): Promise<AffineRuntime> {
  const [litMod, servicesMod, stdMod] = await Promise.all([
    importRuntimeModule("@blocksuite/affine/global/lit"),
    importRuntimeModule("@blocksuite/affine/shared/services"),
    importRuntimeModule("@blocksuite/affine/std"),
  ]);
  const litRuntime = litMod as {
    SignalWatcher: AffineRuntime["SignalWatcher"];
    WithDisposable: AffineRuntime["WithDisposable"];
  };
  const servicesRuntime = servicesMod as { ThemeProvider: unknown };
  const stdRuntime = stdMod as {
    BlockStdScope: AffineRuntime["BlockStdScope"];
    ShadowlessElement: AffineRuntime["ShadowlessElement"];
  };
  return {
    BlockStdScope: stdRuntime.BlockStdScope,
    ShadowlessElement: stdRuntime.ShadowlessElement,
    SignalWatcher: litRuntime.SignalWatcher,
    ThemeProvider: servicesRuntime.ThemeProvider,
    WithDisposable: litRuntime.WithDisposable,
  };
}

function createGutuAffineEditorContainer(runtime: AffineRuntime): CustomElementConstructor {
  const { BlockStdScope, ShadowlessElement, SignalWatcher, ThemeProvider, WithDisposable } = runtime;

  return class GutuAffineEditorContainer extends SignalWatcher(
    WithDisposable(ShadowlessElement),
  ) {
  static styles = css`
    .affine-page-viewport {
      position: relative;
      display: flex;
      flex-direction: column;
      overflow-x: hidden;
      overflow-y: auto;
      container-name: viewport;
      container-type: inline-size;
      font-family: var(--affine-font-family);
    }
    .affine-page-viewport * {
      box-sizing: border-box;
    }
    @media print {
      .affine-page-viewport {
        height: auto;
      }
    }
    .playground-page-editor-container {
      flex-grow: 1;
      font-family: var(--affine-font-family);
      display: block;
    }
    .playground-page-editor-container * {
      box-sizing: border-box;
    }
    @media print {
      .playground-page-editor-container {
        height: auto;
      }
    }
    .edgeless-editor-container {
      font-family: var(--affine-font-family);
      background: var(--affine-background-primary-color);
      display: block;
      height: 100%;
      position: relative;
      overflow: clip;
    }
    .edgeless-editor-container * {
      box-sizing: border-box;
    }
    @media print {
      .edgeless-editor-container {
        height: auto;
      }
    }
    .affine-edgeless-viewport {
      display: block;
      height: 100%;
      position: relative;
      overflow: clip;
      container-name: viewport;
      container-type: inline-size;
    }
  `;

  private readonly _doc = signal<AffineStore | undefined>(undefined);
  private readonly _edgelessSpecs = signal<unknown[]>([]);
  private readonly _mode = signal<AffineDocMode>("page");
  private readonly _pageSpecs = signal<unknown[]>([]);

  private readonly _specs = computed(() =>
    this._mode.value === "page"
      ? this._pageSpecs.value
      : this._edgelessSpecs.value,
  );

  private readonly _std = computed(() => {
    return new BlockStdScope({
      store: this.doc,
      extensions: this._specs.value,
    });
  });

  private readonly _editorTemplate = computed(() => {
    return this._std.value.render();
  });

  get doc(): AffineStore {
    return this._doc.value as AffineStore;
  }
  set doc(doc: AffineStore) {
    this._doc.value = doc;
  }

  set edgelessSpecs(specs: unknown[]) {
    this._edgelessSpecs.value = specs;
  }
  get edgelessSpecs(): unknown[] {
    return this._edgelessSpecs.value;
  }

  set pageSpecs(specs: unknown[]) {
    this._pageSpecs.value = specs;
  }
  get pageSpecs(): unknown[] {
    return this._pageSpecs.value;
  }

  get host(): unknown {
    try {
      return this.std.host;
    } catch {
      return null;
    }
  }

  get mode(): AffineDocMode {
    return this._mode.value;
  }
  set mode(mode: AffineDocMode) {
    this._mode.value = mode;
  }

  get rootModel(): { id: string } {
    return { id: this.doc.root?.id ?? "root" };
  }

  get std(): AffineBlockStdScope {
    return this._std.value;
  }

  connectedCallback(): void {
    const baseConnected = Reflect.get(
      Object.getPrototypeOf(GutuAffineEditorContainer.prototype),
      "connectedCallback",
      this,
    ) as (() => void) | undefined;
    baseConnected?.call(this);
    const subscription = this.doc.slots?.rootAdded?.subscribe(() => {
      (this as unknown as { requestUpdate?: () => void }).requestUpdate?.();
    });
    if (subscription && "_disposables" in this) {
      (this as unknown as { _disposables: { add: (value: unknown) => void } })._disposables.add(subscription);
    }
  }

  firstUpdated(): void {
    if (this.mode === "page") {
      setTimeout(() => {
        if (this.autofocus && this.mode === "page") {
          const richText = this.querySelector("rich-text") as
            | (HTMLElement & { inlineEditor?: { focusEnd: () => void } })
            | null;
          richText?.inlineEditor?.focusEnd();
        }
      });
    }
  }

  render(): unknown {
    const mode = this._mode.value;
    const themeService = this.std.get(ThemeProvider);
    const appTheme = themeService.app$?.value ?? "light";
    const edgelessTheme = themeService.edgeless$?.value ?? appTheme;

    return html`${keyed(
      this.rootModel.id + mode,
      html`
        <div
          data-theme=${mode === "page" ? appTheme : edgelessTheme}
          class=${mode === "page"
            ? "affine-page-viewport"
            : "affine-edgeless-viewport"}
        >
          ${when(
            mode === "page",
            () => html` <doc-title .doc=${this.doc}></doc-title> `,
          )}
          <div
            class=${mode === "page"
              ? "page-editor playground-page-editor-container"
              : "edgeless-editor-container"}
          >
            ${this._editorTemplate.value}
          </div>
        </div>
      `,
    )}`;
  }

  switchEditor(mode: AffineDocMode): void {
    this._mode.value = mode;
  }

  // Keep `autofocus` as a plain instance property — Lit doesn't need a
  // reactive property for it because we only read it once on
  // firstUpdated(). Avoids the TC39-stage-3 `accessor` keyword + decorator
  // combo which requires extra esbuild config.
  autofocus = false;
};
}

/** Register the custom element. Idempotent — safe to call multiple times. */
export async function registerAffineEditorContainer(): Promise<void> {
  if (customElements.get("affine-editor-container")) return;
  registerPromise ??= loadAffineRuntime().then((runtime) => {
    if (!customElements.get("affine-editor-container")) {
      customElements.define("affine-editor-container", createGutuAffineEditorContainer(runtime));
    }
  });
  await registerPromise;
}

declare global {
  interface HTMLElementTagNameMap {
    "affine-editor-container": GutuAffineEditorElement;
  }
}
