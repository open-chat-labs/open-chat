<script lang="ts">
    import { i18nKey } from "@src/i18n/i18n";
    import { Container, UserChip } from "component-lib";
    import type { OpenChat, UserOrUserGroup, UserSummary } from "openchat-client";
    import { getContext, type Snippet } from "svelte";
    import ErrorMessage from "../ErrorMessage.svelte";
    import FindUser from "../FindUser.svelte";
    import Translatable from "../Translatable.svelte";

    const client = getContext<OpenChat>("client");

    type OnSelectUser = (user: UserSummary) => void;
    type OnDeleteUser = (user: UserOrUserGroup) => void;

    interface Props {
        mode: "add" | "edit";
        selectedUsers: UserSummary[];
        enabled?: boolean;
        userLookup: (searchTerm: string) => Promise<[UserSummary[], UserSummary[]]>;
        onDeleteUser: OnDeleteUser;
        onSelectUser: OnSelectUser;
        matchingUser?: Snippet<[UserSummary, OnSelectUser]>;
        placeholderKey?: string;
        dmFilter?: (user: UserSummary) => boolean;
        onClear?: () => void;
    }

    let {
        selectedUsers,
        userLookup,
        onDeleteUser,
        onSelectUser,
        matchingUser,
        placeholderKey,
        dmFilter,
    }: Props = $props();

    let error: string | undefined = undefined;
</script>

{#if error !== undefined}
    <ErrorMessage><Translatable resourceKey={i18nKey("errorSearchingForUser")} /></ErrorMessage>
{/if}

<Container direction={"vertical"} gap={"lg"}>
    <FindUser
        {dmFilter}
        {matchingUser}
        {selectedUsers}
        {userLookup}
        {onSelectUser}
        {placeholderKey}>
        {#snippet selected()}
            {#if selectedUsers.length > 0}
                <Container wrap gap={"sm"} crossAxisAlignment={"center"}>
                    {#each selectedUsers as user (user.userId)}
                        <UserChip
                            avatarUrl={client.userAvatarUrl(user)}
                            onRemove={() => onDeleteUser(user)}>@{user.username}</UserChip>
                    {/each}
                </Container>
            {/if}
        {/snippet}
    </FindUser>
</Container>
