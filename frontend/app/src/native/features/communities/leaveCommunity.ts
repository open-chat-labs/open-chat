import type { CommunityIdentifier, CommunitySummary, OpenChat } from "@client";
import { toastStore } from "@src/stores/toast";
import { navigate } from "@src/utils/navigation";
import type { ScreenContext } from "../app/screens";
import { sendAfterUndo } from "../chats/removeWithUndo";
import { communityKey, nextCommunity, type SwitcherCommunity } from "./community.adapter";

/**
 * Leaving a community, or deleting it (its owner), with Undo (notes §1): it goes from the switcher
 * at once, the tab moving on to the next community if it's the one showing (Explore with none
 * left), and the leave or delete is sent once the toast has gone (the shell's PendingRemovals);
 * Undo sends nothing, puts it back and, if it was showing, shows it again. The community page's
 * menu and the details (after their confirm) both do it.
 */
export function removeCommunityWithUndo(
    client: Pick<OpenChat, "leaveOrDelete">,
    context: Pick<ScreenContext, "toast" | "removals">,
    target: CommunitySummary,
    kind: "leave" | "delete",
    showing: CommunityIdentifier,
    switcher: readonly Pick<SwitcherCommunity, "id">[],
    message: string,
): void {
    const key = communityKey(target.id);
    const isShowing = target.id.communityId === showing.communityId;
    if (isShowing) {
        const next = nextCommunity(switcher, target.id);
        navigate(next === undefined ? "/communities" : `/community/${next.communityId}`);
    }
    const url = `/community/${target.id.communityId}`;
    sendAfterUndo(
        context,
        key,
        message,
        async () =>
            toastStore.showOutcome(
                await client.leaveOrDelete(
                    kind === "leave"
                        ? { kind: "leave_community", id: target.id }
                        : { kind: "delete_community", id: target.id },
                    true,
                ),
            ),
        isShowing ? () => navigate(url) : undefined,
    );
}
