<!-- Someone's profile card, opened by a name clicked in a message (`<profile-link>`). A first cut:
     the user's name and the Chat button, which opens a DM with them (as the old UI's card). 4a
     builds the rest from the user adapter: avatar, bio, badges, the "This chat" tab, and loading a
     user that isn't known yet. -->
<script lang="ts">
    import { allUsersStore, OpenChat, publish } from "@client";
    import UserDialog from "@openchat/ui/src/features/components/UserDialog.svelte";
    import { profileCardChat } from "@src/logic/profile/profileCard";
    import { getContext } from "svelte";
    import type { DialogProps, LocalDialog } from "../app/dialogs";

    let { dialog, onClose }: DialogProps<Extract<LocalDialog, { kind: "user" }>> = $props();

    const client = getContext<OpenChat>("client");

    // getDisplayName reads the users as they are; reading the store re-runs it as they load
    const title = $derived.by(() => {
        $allUsersStore.get(dialog.userId);
        return client.getDisplayName(dialog.userId);
    });

    function chat() {
        onClose();
        publish("chatWith", profileCardChat(dialog));
    }
</script>

<!-- TODO(phase 4, 4a): the user adapter's fields -->
<UserDialog
    {title}
    facts={[]}
    onMessage={dialog.chatButton ? chat : undefined}
    onCancel={onClose} />
