<script lang="ts">
    import { UserChip } from "component-lib";
    import type { OpenChat, UserOrUserGroup } from "openchat-client";
    import { selectedChatWebhooksStore, selectedCommunityMembersStore } from "openchat-client";
    import { getContext } from "svelte";

    const client = getContext<OpenChat>("client");

    interface Props {
        userOrGroup: UserOrUserGroup;
        onDeleteUser: (user: UserOrUserGroup) => void;
    }

    let { userOrGroup, onDeleteUser }: Props = $props();

    let avatarUrl = $derived(
        userOrGroup.kind === "user_group" || userOrGroup.kind === "everyone"
            ? undefined
            : client.userAvatarUrl(userOrGroup),
    );

    let displayName = $derived(
        userOrGroup.kind === "user_group" || userOrGroup.kind === "everyone"
            ? undefined
            : client.getDisplayName(
                  userOrGroup.userId,
                  $selectedCommunityMembersStore,
                  $selectedChatWebhooksStore,
              ),
    );
</script>

<UserChip {avatarUrl} onRemove={() => onDeleteUser(userOrGroup)}>
    {displayName}
</UserChip>
