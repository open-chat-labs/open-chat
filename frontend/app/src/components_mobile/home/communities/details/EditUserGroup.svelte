<script lang="ts">
    import { toastStore } from "@src/stores/toast";
    import {
        Body,
        BodySmall,
        ColourVars,
        Container,
        FloatingButton,
        Input,
        Search,
        UserChip,
    } from "component-lib";
    import {
        allUsersStore,
        ErrorCode,
        publish,
        selectedCommunityMembersStore,
        type CommunitySummary,
        type Member,
        type OpenChat,
        type ReadonlyMap,
        type UserGroupDetails,
        type UserLookup,
        type UserSummary,
    } from "openchat-client";
    import { getContext, onMount } from "svelte";
    import { _ } from "svelte-i18n";
    import Check from "svelte-material-icons/Check.svelte";
    import Save from "svelte-material-icons/ContentSaveOutline.svelte";
    import { SvelteSet } from "svelte/reactivity";
    import { i18nKey, interpolate } from "../../../../i18n/i18n";
    import { trimLeadingAtSymbol } from "../../../../utils/user";
    import Translatable from "../../../Translatable.svelte";
    import SlidingPageContent from "../../SlidingPageContent.svelte";
    import User from "../../User.svelte";
    import { CommunityState } from "./communityState.svelte";

    const MIN_LENGTH = 3;
    const MAX_LENGTH = 25;
    const client = getContext<OpenChat>("client");

    interface Props {
        community: CommunitySummary;
        original: UserGroupDetails;
    }

    let { community, original }: Props = $props();

    let communityUsers: Record<string, UserSummary> = $state({});
    let communityUsersList: UserSummary[] = $state([]);

    onMount(() => {
        communityUsers = createLookup($selectedCommunityMembersStore, $allUsersStore);
        communityUsersList = Object.values(communityUsers);
    });

    function createLookup(
        members: ReadonlyMap<string, Member>,
        allUsers: UserLookup,
    ): Record<string, UserSummary> {
        return [...members.values()].reduce(
            (map, m) => {
                const user = allUsers.get(m.userId);
                if (user !== undefined) {
                    map[user.userId] = {
                        ...user,
                        displayName: m.displayName ?? user.displayName,
                        username: user.username,
                    };
                }
                return map;
            },
            {} as Record<string, UserSummary>,
        );
    }

    let userGroup = $state<UserGroupDetails>({
        kind: original.kind,
        id: original.id,
        name: original.name,
        members: new SvelteSet(original.members),
    });

    let added = $derived(userGroup.members.difference(original.members));
    let removed = $derived(original.members.difference(userGroup.members));
    let nameDirty = $derived(original.name !== userGroup.name);
    let dirty = $derived(nameDirty || added.size > 0 || removed.size > 0);
    let saving = $state(false);
    let communityState = new CommunityState(client, community);
    let searchTermEntered = $state("");
    let trimmedName = $derived(userGroup.name.trim());
    let nameValid = $derived(
        trimmedName.length >= MIN_LENGTH &&
            trimmedName.length <= MAX_LENGTH &&
            trimmedName.indexOf(" ") < 0,
    );
    let valid = $derived(nameValid && userGroup.members.size > 0);
    let matchedUsers = $derived(
        communityUsersList.filter((u) => matchesSearch(searchTermLower, u)),
    );

    function matchesSearch(searchTerm: string, user: UserSummary): boolean {
        if (searchTerm === "") return false;
        return (
            user.username.toLowerCase().includes(searchTerm) ||
            (user.displayName !== undefined && user.displayName.toLowerCase().includes(searchTerm))
        );
    }

    let searchTerm = $derived(trimLeadingAtSymbol(searchTermEntered));
    let searchTermLower = $derived(searchTerm.toLowerCase());
    let groupUsers = $derived(
        [...userGroup.members]
            .map((m) => $allUsersStore.get(m))
            .filter((u) => u !== undefined) as UserSummary[],
    );

    $effect(() => {
        if (nameDirty) {
            userGroup.name = userGroup.name.replace(/ /g, "_");
        }
    });

    function addUser(user: UserSummary) {
        userGroup.members.add(user.userId);
    }

    function saveUserGroup() {
        saving = true;
        const creating = userGroup.id === -1;
        (creating
            ? client.createUserGroup(community.id, userGroup)
            : client.updateUserGroup(community.id, userGroup, added, removed)
        )
            .then((resp) => {
                if (resp.kind === "success") {
                    publish("closeModalPage");
                } else {
                    if (resp.kind === "error" && resp.code === ErrorCode.NameTaken) {
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

    function removeUser(user: UserSummary) {
        userGroup.members.delete(user.userId);
    }
</script>

<SlidingPageContent subtitle={i18nKey("Edit user group")} title={i18nKey(userGroup.name)}>
    <Container height={{ kind: "fill" }} mainAxisAlignment={"spaceBetween"} direction={"vertical"}>
        <Container
            height={{ kind: "fill" }}
            gap={"xl"}
            padding={["xxl", "lg", "lg", "lg"]}
            direction={"vertical"}>
            <Container padding={["zero", "md"]} direction={"vertical"}>
                <BodySmall colour={"textSecondary"}>
                    <Translatable
                        resourceKey={i18nKey(
                            `Modify the ${userGroup.name} group, update its name, or remove and add new members.`,
                        )} />
                </BodySmall>
            </Container>

            <Input
                bind:value={userGroup.name}
                minlength={MIN_LENGTH}
                maxlength={MAX_LENGTH}
                disabled={!communityState.canManageUserGroups}
                countdown
                error={nameDirty && !nameValid}
                placeholder={interpolate($_, i18nKey("communities.enterUserGroupName"))}>
                {#snippet subtext()}
                    <Translatable resourceKey={i18nKey("Provide a name for the user group")} />
                {/snippet}
            </Input>

            <Search
                searching={false}
                bind:value={searchTermEntered}
                placeholder={interpolate($_, i18nKey("Search community members..."))} />

            <Container wrap padding={["zero", "md"]} gap={"sm"}>
                {#each groupUsers as user}
                    <UserChip
                        onRemove={() => removeUser(user)}
                        avatarUrl={client.userAvatarUrl(user)}>
                        {user.username}
                    </UserChip>
                {/each}
            </Container>

            <Container direction={"vertical"} wrap padding={["zero", "md"]} gap={"xl"}>
                <Body fontWeight={"bold"}>
                    <Translatable resourceKey={i18nKey("Search results")} />
                </Body>
                {#each matchedUsers as user}
                    {#snippet action()}
                        <Check color={ColourVars.primary} size={"1.5rem"} />
                    {/snippet}
                    <User
                        action={userGroup.members.has(user.userId) ? action : undefined}
                        profile={false}
                        onClick={() => addUser(user)}
                        {searchTerm}
                        {user} />
                {/each}
            </Container>
        </Container>
    </Container>
    {#if communityState.canManageUserGroups}
        <FloatingButton
            loading={saving}
            disabled={!dirty || !valid}
            pos={{ bottom: "lg", right: "lg" }}
            onClick={saveUserGroup}>
            {#snippet icon(color)}
                <Save {color} />
            {/snippet}
        </FloatingButton>
    {/if}
</SlidingPageContent>
