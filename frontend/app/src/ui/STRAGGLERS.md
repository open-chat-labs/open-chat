# Cross-platform stragglers

`src/ui` is for deliberately platform-agnostic primitives. The components below
did not arrive here by design — the import-graph classifier found consumers in
both the desktop and mobile trees, which violates the "no shared components
between the apps" rule. Each needs a review: either promote it to a real,
intentional shared primitive, or fork it into the platform trees and delete it
from here.

Moved from the former `components/` (desktop) tree:

- `Button.svelte`
- `ButtonGroup.svelte`
- `EditableAvatar.svelte`
- `EditableBanner.svelte`
- `EditableImageWrapper.svelte`
- `HoverIcon.svelte`
- `ModalContent.svelte`
- `Overlay.svelte`
- `SignalsButton.svelte`
- `StandardButton.svelte`
- `Translatable.svelte`
- `calendarUtils.ts` (was `components/calendar/utils.ts`)

Everything else in `src/ui` came from the former `components_shared/` tree and
is here on purpose.
