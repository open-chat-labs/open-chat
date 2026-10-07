<script lang="ts">
    import {
        FIND_MEMBERS_DELAY_MS,
        iconSize,
        type CommunitySummary,
        type OpenChat,
        type UserGroupDetails,
        type UserSummary,
    } from "@client";
    import { ErrorCode } from "@shared";
    import { getContext } from "svelte";
    import { _ } from "svelte-i18n";
    import DeleteOutline from "svelte-material-icons/DeleteOutline.svelte";
    import { SvelteSet } from "svelte/reactivity";
    import { i18nKey } from "../../../../i18n/i18n";
    import { toastStore } from "../../../../stores/toast";
    import { trimLeadingAtSymbol } from "../../../../utils/user";
    import Button from "../../../Button.svelte";
    import ButtonGroup from "../../../ButtonGroup.svelte";
    import Input from "../../../Input.svelte";
    import Legend from "../../../Legend.svelte";
    import Search from "../../../Search.svelte";
    import Translatable from "@shared_components/Translatable.svelte";
    import VirtualList from "@shared_components/VirtualList.svelte";
    import User from "../../groupdetails/User.svelte";
    import Markdown from "@shared_components/Markdown.svelte";

    const client = getContext<OpenChat>("client");

    interface Props {
        community: CommunitySummary;
        original: UserGroupDetails;
        canManageUserGroups: boolean;
        communityUsers?: Record<string, UserSummary>;
        communityUsersList?: UserSummary[];
        onCancel: () => void;
    }

    let {
        community,
        original,
        canManageUserGroups,
        communityUsers = {},
        communityUsersList = [],
        onCancel,
    }: Props = $props();

    let userGroup = $state(workingCopy());
    let added: Set<string> = new Set();
    let removed: Set<string> = new Set();
    let searchVirtualList = $state<VirtualList<UserSummary> | undefined>();
    let searchTermEntered = $state("");
    let usersDirty = $state(false);
    let saving = $state(false);

    const MIN_LENGTH = 3;
    const MAX_LENGTH = 25;
    const MAX_SEARCH_RESULTS = 255;

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
                    if (resp.kind === "error" && resp.code === ErrorCode.NameTaken) {
                        toastStore.showFailureToast(
                            i18nKey("communities.errors.userGroupNameTaken"),
                        );
                    } else if (resp.kind === "error" && resp.code === ErrorCode.TooManyUsers) {
                        // The canister sends the limit as the error's message
                        toastStore.showFailureToast(
                            i18nKey("communities.errors.userGroupTooManyMembers", {
                                max: resp.message,
                            }),
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
        onCancel();
    }

    // the members are edited in a copy of the set, because the original's set belongs to the
    // store and so must not be changed here. A successful save reaches the list through the
    // local update which the client records.
    function workingCopy(): UserGroupDetails {
        return { ...original, members: new SvelteSet(original.members) };
    }

    function reset() {
        userGroup = workingCopy();
        added = new Set();
        removed = new Set();
        usersDirty = false;
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

    function addUserToGroup(userId: string) {
        searchTermEntered = "";
        added.add(userId);
        removed.delete(userId);
        userGroup.members.add(userId);
        usersDirty = true;
    }

    function removeUserFromGroup(userId: string) {
        removed.add(userId);
        added.delete(userId);
        userGroup.members.delete(userId);
        usersDirty = true;
    }
    let searchTerm = $derived(trimLeadingAtSymbol(searchTermEntered));
    let searchTermLower = $derived(searchTerm.toLowerCase());
    // If the community holds only some of its members, those who match what has been typed are
    // searched for. Those found are then held, so are among the matches.
    $effect(() => {
        const searchFor = searchTerm;
        if (searchFor.length < 2 || !client.membersIncomplete(community.id)) return;
        const timer = setTimeout(
            () => client.findMembers(community.id, searchFor, MAX_SEARCH_RESULTS),
            FIND_MEMBERS_DELAY_MS,
        );
        return () => clearTimeout(timer);
    });
    let groupUsers = $derived(
        [...userGroup.members].map((m) => communityUsers[m]).filter((u) => u !== undefined),
    );
    let matchedUsers = $derived(
        communityUsersList.filter((u) => matchesSearch(searchTermLower, u)),
    );
    let nameDirty = $derived(original.name !== userGroup.name);
    let dirty = $derived(nameDirty || usersDirty);
    let trimmedName = $derived(userGroup.name.trim());
    let nameValid = $derived(
        trimmedName.length >= MIN_LENGTH &&
            trimmedName.length <= MAX_LENGTH &&
            trimmedName.indexOf(" ") < 0,
    );
    let valid = $derived(nameValid && userGroup.members.size > 0);
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
                onBlur={autoCorrect}
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
                    items={matchedUsers}>
                    {#snippet children(item)}
                        <User
                            onClick={() => addUserToGroup(item.userId)}
                            user={item}
                            me={false}
                            profile={false}
                            {searchTerm} />
                    {/snippet}
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
                        <div onclick={() => removeUserFromGroup(user.userId)} class="delete">
                            <DeleteOutline size={$iconSize} color={"var(--icon-txt)"} />
                        </div>
                    {/if}
                </User>
            </div>
        {/each}
    </div>

    <div class="buttons">
        <ButtonGroup align="fill">
            <Button onClick={cancel} secondary
                ><Translatable resourceKey={i18nKey("cancel")} /></Button>
            {#if canManageUserGroups}
                <Button onClick={save} disabled={!dirty || !valid || saving} loading={saving}
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
