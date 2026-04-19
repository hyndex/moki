import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";

const typedTsConfigs = tseslint.configs.recommendedTypeChecked.map((config) => ({
  ...config,
  files: ["**/*.ts", "**/*.tsx"],
  languageOptions: {
    ...config.languageOptions,
    parserOptions: {
      ...config.languageOptions?.parserOptions,
      projectService: true,
      tsconfigRootDir: import.meta.dirname
    },
    globals: {
      ...globals.node,
      ...globals.browser,
      ...config.languageOptions?.globals
    }
  }
}));

export default tseslint.config(
  {
    ignores: [
      "**/dist/**",
      "**/coverage/**",
      "**/node_modules/**",
      "**/playwright-report/**",
      "**/test-results/**"
    ]
  },
  js.configs.recommended,
  {
    files: [
      "plugins/**/src/ui/admin.contributions.ts",
      "plugins/**/src/ui/admin/**/*.{ts,tsx}",
      "plugins/**/src/ui/admin*.{ts,tsx}"
    ],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            { name: "@tanstack/react-router", message: "Use @platform/router in admin-registered plugins." },
            { name: "@tanstack/react-query", message: "Use @platform/query in admin-registered plugins." },
            { name: "@tanstack/react-table", message: "Use @platform/data-table in admin-registered plugins." },
            { name: "@tanstack/react-virtual", message: "Use @platform/data-table in admin-registered plugins." },
            { name: "react-hook-form", message: "Use @platform/form in admin-registered plugins." },
            { name: "@hookform/resolvers", message: "Use @platform/form in admin-registered plugins." },
            { name: "lucide-react", message: "Use @platform/ui in admin-registered plugins." },
            { name: "sonner", message: "Use @platform/ui in admin-registered plugins." },
            { name: "cmdk", message: "Use @platform/command-palette in admin-registered plugins." },
            { name: "date-fns", message: "Use @platform/ui in admin-registered plugins." },
            { name: "echarts", message: "Use @platform/chart in admin-registered plugins." }
          ],
          patterns: [
            {
              group: ["@radix-ui/*"],
              message: "Use @platform/ui in admin-registered plugins."
            },
            {
              group: ["@tiptap/*"],
              message: "Use @platform/editor in admin-registered plugins."
            },
            {
              group: ["@react-email/*"],
              message: "Use @platform/email-templates in admin-registered plugins."
            }
          ]
        }
      ]
    }
  },
  {
    files: [
      "plugins/**/src/ui/zone/**/*.{ts,tsx}",
      "plugins/**/src/ui/zones/**/*.{ts,tsx}",
      "plugins/**/src/ui/**/*.zone.{ts,tsx}"
    ],
    rules: {
      "no-restricted-imports": "off"
    }
  },
  {
    files: ["**/*.js", "**/*.mjs"],
    languageOptions: {
      globals: {
        ...globals.node
      }
    }
  },
  ...typedTsConfigs,
  {
    files: ["**/*.ts", "**/*.tsx"],
    languageOptions: {
      globals: {
        ...globals.node,
        ...globals.browser
      }
    },
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh
    },
    rules: {
      "@typescript-eslint/consistent-type-imports": "error",
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/no-floating-promises": "error",
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "error",
      "react-refresh/only-export-components": [
        "warn",
        { "allowConstantExport": true }
      ]
    }
  }
);
