<script lang="ts">
    import Input from "../../../Input.svelte";
    import DeleteOutline from "svelte-material-icons/DeleteOutline.svelte";
    import ButtonGroup from "../../../ButtonGroup.svelte";
    import Button from "../../../Button.svelte";
    import { _ } from "svelte-i18n";
    import type {
        OpenChat,
        UserGroupDetails,
        UserSummary,
        CommunitySummary,
    } from "openchat-client";
    import Search from "../../../Search.svelte";
    import { createEventDispatcher, getContext } from "svelte";
    import User from "../../groupdetails/User.svelte";
    import { iconSize } from "../../../../stores/iconSize";
    import { toastStore } from "../../../../stores/toast";
    import VirtualList from "../../../VirtualList.svelte";
    import Markdown from "../../Markdown.svelte";
    import Legend from "../../../Legend.svelte";
    import { i18nKey } from "../../../../i18n/i18n";
    import Translatable from "../../../Translatable.svelte";
    import { trimLeadingAtSymbol } from "../../../../utils/user";

    const dispatch = createEventDispatcher();
    const client = getContext<OpenChat>("client");

    export let community: CommunitySummary;
    export let original: UserGroupDetails;
    export let canManageUserGroups: boolean;
    export let communityUsers: Record<string, UserSummary> = {};
    export let communityUsersList: UserSummary[] = [];

    let userGroup = { ...original };
    let added: Set<string> = new Set();
    let removed: Set<string> = new Set();
    let searchVirtualList: VirtualList;
    let searchTermEntered = "";
    let usersDirty = false;
    let saving = false;

    $: searchTerm = trimLeadingAtSymbol(searchTermEntered);
    $: searchTermLower = searchTerm.toLowerCase();
    $: groupUsers = [...userGroup.members]
        .map((m) => communityUsers[m])
        .filter((u) => u !== undefined);
    $: matchedUsers = communityUsersList.filter((u) => matchesSearch(searchTermLower, u));
    $: nameDirty = original.name !== userGroup.name;
    $: dirty = nameDirty || usersDirty;
    $: trimmedName = userGroup.name.trim();
    $: nameValid =
        trimmedName.length >= MIN_LENGTH &&
        trimmedName.length <= MAX_LENGTH &&
        trimmedName.indexOf(" ") < 0;
    $: valid = nameValid && userGroup.members.size > 0;

    const MIN_LENGTH = 3;
    const MAX_LENGTH = 25;

    // we are going to just wait for the save to succeed here rather than mess about with
    // local updates since this is probably not a very common operation and it's much simpler this way
    function save() {
        saving = true;
        const creating = userGroup.id === -1;
        (creating
            ? client.createUserGroup(community.id, userGroup)
            : client.updateUserGroup(community.id, userGroup, added, removed)
        )
            .then((resp) => {
                if (resp.kind === "success") {
                    cancel();
                } else {
                    if (resp.kind === "name_taken") {
                        toastStore.showFailureToast(
                            i18nKey("communities.errors.userGroupNameTaken"),
                        );
                    } else {
                        toastStore.showFailureToast(
                            i18nKey(
                                `communities.errors.${
                                    creating ? "createGroupFailed" : "updateGroupFailed"
                                }`,
                            ),
                        );
                    }
                }
            })
            .finally(() => (saving = false));
    }

    function autoCorrect() {
        if (nameDirty) {
            userGroup.name = userGroup.name.replace(/ /g, "_");
        }
    }

    function cancel() {
        reset();
        dispatch("cancel");
    }

    function reset() {
        userGroup = original;
        added = new Set();
        removed = new Set();
    }

    function matchesSearch(searchTerm: string, user: UserSummary): boolean {
        if (searchTerm === "") return false;
        return (
            !userGroup.members.has(user.userId) &&
            (user.username.toLowerCase().includes(searchTerm) ||
                (user.displayName !== undefined &&
                    user.displayName.toLowerCase().includes(searchTerm)))
        );
    }

    function addUserToGroup(user: UserSummary) {
        searchTermEntered = "";
        added.add(user.userId);
        removed.delete(user.userId);
        changeUsers(() => userGroup.members.add(user.userId));
    }

    function removeUserFromGroup(user: UserSummary) {
        removed.add(user.userId);
        added.delete(user.userId);
        changeUsers(() => userGroup.members.delete(user.userId));
    }

    function changeUsers(fn: () => void) {
        fn();
        usersDirty = true;
        userGroup = userGroup; //:puke: trigger a reaction
    }
</script>

<div class="user-group">
    {#if canManageUserGroups}
        <div class="header">
            <Legend
                label={i18nKey("communities.userGroupName")}
                rules={i18nKey("communities.noSpaces")} />
            <Input
                bind:value={userGroup.name}
                minlength={MIN_LENGTH}
                maxlength={MAX_LENGTH}
                disabled={!canManageUserGroups}
                countdown
                invalid={nameDirty && !nameValid}
                onblur={autoCorrect}
                placeholder={i18nKey("communities.enterUserGroupName")} />
        </div>
        <div class="search">
            <Search
                onPerformSearch={() => searchVirtualList?.reset()}
                fill
                searching={false}
                bind:searchTerm={searchTermEntered}
                placeholder={i18nKey("searchUsersPlaceholder")} />
        </div>
        {#if matchedUsers.length > 0}
            <div style={`height: ${matchedUsers.length * 80}px`} class="searched-users">
                <VirtualList
                    bind:this={searchVirtualList}
                    keyFn={(user) => user.userId}
                    items={matchedUsers}
                    let:item>
                    <User
                        on:click={() => addUserToGroup(item)}
                        user={item}
                        me={false}
                        profile={false}
                        {searchTerm} />
                </VirtualList>
            </div>
        {/if}
    {/if}

    <div class="users">
        <div class="legend" class:readonly={!canManageUserGroups}>
            {#if canManageUserGroups}
                <Translatable resourceKey={i18nKey("communities.userGroupMembers")} />
            {:else}
                <Markdown
                    text={$_("communities.namedUserGroupMembers", {
                        values: { name: userGroup.name },
                    })} />
            {/if}
        </div>
        {#each groupUsers as user}
            <div class="user">
                <User {user} me={false}>
                    {#if canManageUserGroups}
                        <div on:click={() => removeUserFromGroup(user)} class="delete">
                            <DeleteOutline size={$iconSize} color={"var(--icon-txt)"} />
                        </div>
                    {/if}
                </User>
            </div>
        {/each}
    </div>

    <div class="buttons">
        <ButtonGroup align="fill">
            <Button on:click={cancel} secondary
                ><Translatable resourceKey={i18nKey("cancel")} /></Button>
            {#if canManageUserGroups}
                <Button on:click={save} disabled={!dirty || !valid || saving} loading={saving}
                    ><Translatable resourceKey={i18nKey("save")} /></Button>
            {/if}
        </ButtonGroup>
    </div>
</div>

<style lang="scss">
    :global(.user-group .header .input-wrapper) {
        margin-bottom: 0;
    }

    :global(.user-group .search .wrapper) {
        padding: 0 $sp3;
    }

    .header,
    .search,
    .buttons {
        padding: 0 $sp4;
        @include mobile() {
            padding: 0 $sp3;
        }
    }

    .searched-users {
        max-height: calc(var(--vh, 1vh) * 50);
    }

    .user-group {
        display: flex;
        flex-direction: column;
        gap: toRem(12);
        height: 100%;
        justify-content: space-between;

        .users {
            flex: auto;

            .legend {
                padding: $sp4;
                border-bottom: 1px solid var(--bd);

                &.readonly {
                    padding-top: 0;
                }
            }

            .user {
                .delete {
                    transition: opacity 250ms ease-in-out;
                    opacity: 0.6;
                }

                &:hover {
                    .delete {
                        opacity: 1;
                    }
                }
            }
        }
    }
</style>
