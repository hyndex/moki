/** Side-effect import that registers every built-in advanced field
 *  kind into the field-kind registry. Imported once from
 *  `FieldInput.tsx` and `renderValue.ts`; idempotent — registering
 *  twice replaces the previous renderer.
 *
 *  Plugins that ship their own kind register through the same
 *  `registerFieldKind()` API (no need to import this file from a
 *  plugin). */

import { registerFieldKind } from "../fieldKindRegistry";
import { relationshipKind } from "./relationship";
import { tagsKind } from "./tags";
import { fileKind } from "./file";
import { imageKind } from "./image";
import { geoPointKind } from "./geo";
import { videoKind, audioKind } from "./media";
import { codeKind } from "./code";
import { markdownKind } from "./markdown";
import { colorKind } from "./color";
import { durationKind } from "./duration";
import { sparklineKind } from "./sparkline";

/* Tier 1 — relationships + tags */
registerFieldKind("reference", relationshipKind);
registerFieldKind("link", relationshipKind);
registerFieldKind("dynamic-link", relationshipKind);
registerFieldKind("tags", tagsKind);
// `multi-enum` shares the chip UI when options are present; keep the
// legacy checkbox grid as opt-in via a per-field `chips: false` flag
// in a follow-up if anyone misses it.
registerFieldKind("multi-enum", tagsKind);

/* Tier 1 — files + images */
registerFieldKind("file", fileKind);
registerFieldKind("image", imageKind);

/* Tier 2 — geo + media */
registerFieldKind("geo.point", geoPointKind);
registerFieldKind("video", videoKind);
registerFieldKind("audio", audioKind);

/* Tier 3 — code, markdown, color, duration, sparkline */
registerFieldKind("code", codeKind);
registerFieldKind("json", codeKind); // JSON renders through the code kind
registerFieldKind("markdown", markdownKind);
registerFieldKind("color", colorKind);
registerFieldKind("duration", durationKind);
registerFieldKind("sparkline", sparklineKind);
