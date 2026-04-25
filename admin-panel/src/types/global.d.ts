/** Ambient module declarations for asset/CSS module imports.
 *
 *  CSS modules (`*.module.css`) are processed by vite at build/dev time
 *  into an object whose keys are the local class names. TypeScript
 *  needs a type for the import to typecheck — without this, every
 *  `import styles from "./Foo.module.css"` becomes a hard error.
 *
 *  We type the export as a `Readonly<Record<string, string>>` rather
 *  than enumerating every class name (which would require a build
 *  step). Code uses `styles.shellName` as a string anyway, so the
 *  loose type is sufficient. */
declare module "*.module.css" {
  const styles: Readonly<Record<string, string>>;
  export default styles;
}

/** Vite injects environment variables under `import.meta.env`. The
 *  `vite/client` reference would normally provide this, but we don't
 *  pull it in (we use a stricter ambient set). Add the minimum we
 *  read so `import.meta.env.VITE_*` typechecks. */
interface ImportMetaEnv {
  readonly VITE_GUTU_PLUGINS?: string;
  readonly VITE_API_BASE?: string;
  readonly VITE_API_TARGET?: string;
}
interface ImportMeta {
  readonly env: ImportMetaEnv;
}
