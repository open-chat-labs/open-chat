import { navigate } from "@src/utils/navigation";
import { openLinkedDialog, type LinkedDialog } from "./dialogs";

/**
 * Opens a linked dialog in place of the one showing, if any (from the profile, Diamond; from the
 * CHIT dialog, the profile on its CHIT section). From the URL as it is: the query store's values
 * are decoded, so they can't be written back.
 */
export function openLinked(dialog: LinkedDialog): void {
    const query = openLinkedDialog(new URLSearchParams(window.location.search), dialog);
    if (query !== undefined) navigate(`${window.location.pathname}${query}`, "overlay");
}
