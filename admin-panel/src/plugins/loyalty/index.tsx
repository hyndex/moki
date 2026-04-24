/** Loyalty Program — auto-scaffolded plugin. Edit freely. */

import { definePlugin } from "@/contracts/plugin-v2";

export default definePlugin({
  manifest: {
    id: "com.gutu.loyalty",
    version: "0.1.0",
    label: "Loyalty Program",
    description: "Describe what this plugin does.",
    icon: "Plug",
    requires: {
      shell: "^2.0.0",
      capabilities: ["nav", "commands"],
    },
    origin: { kind: "filesystem", location: "src/plugins/loyalty" },
  },

  async activate(ctx) {
    ctx.runtime.logger.info("Loyalty Program activating…");

    ctx.contribute.commands([
      {
        id: "com.gutu.loyalty.hello",
        label: "Loyalty Program: Hello",
        icon: "Sparkles",
        run: () => ctx.runtime.notify({ title: "Hello from Loyalty Program!", intent: "success" }),
      },
    ]);
  },
});
