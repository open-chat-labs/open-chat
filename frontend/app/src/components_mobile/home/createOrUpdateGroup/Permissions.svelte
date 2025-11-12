<script lang="ts">
    import { i18nKey } from "@src/i18n/i18n";
    import { BodySmall, CommonButton, Container, Sheet, Switch } from "component-lib";
    import {
        type ChatPermissionRole,
        chatRoles,
        type MessagePermissions,
        publish,
        type ResourceKey,
        roleAsText,
        selectedCommunitySummaryStore,
    } from "openchat-client";
    import { _ } from "svelte-i18n";
    import ArrowLeft from "svelte-material-icons/ArrowLeft.svelte";
    import Translatable from "../../Translatable.svelte";
    import GroupCard from "../createOrUpdateGroup/GroupCard.svelte";
    import PermissionsRoleSlider from "../PermissionsRoleSlider.svelte";
    import SlidingPageContent from "../SlidingPageContent.svelte";
    import { updateGroupState } from "./group.svelte";

    type Selected = {
        role?: ChatPermissionRole;
        defaultRole?: ChatPermissionRole;
        label: ResourceKey;
        sync: (r?: ChatPermissionRole) => void;
    };

    const data = updateGroupState;
    let defaultText = $derived($_("role.default"));
    let roles = [...chatRoles];
    let isCommunityPublic = $derived($selectedCommunitySummaryStore?.public ?? true);
    let isChannel = $derived(data.candidate.id.kind === "channel");
    let selectedTab = $state("permissions.general");
    let overrideChatMessages = $state(data.permissions.threadPermissions !== undefined);

    let selected = $state<Selected>();

    // This is because I simply cannot get the data binding to work as I *think* it should
    function syncPermission() {
        if (selected !== undefined) {
            selected.sync?.(selected.role);
            selected = undefined;
        }
    }

    function onOverrideChatMessagesChanged() {
        data.permissions.threadPermissions = overrideChatMessages
            ? structuredClone($state.snapshot(data.permissions.messagePermissions))
            : undefined;
    }
</script>

{#if selected !== undefined}
    {@const { label } = selected}
    <Sheet onDismiss={syncPermission}>
        <PermissionsRoleSlider
            height={{ kind: "fixed", size: "250px" }}
            {roles}
            {label}
            onClose={syncPermission}
            defaultRole={selected.defaultRole}
            bind:rolePermission={selected.role} />
    </Sheet>
{/if}

{#snippet permissionSummary(
    label: ResourceKey,
    sync: (r?: ChatPermissionRole) => void,
    role?: ChatPermissionRole,
    defaultRole?: ChatPermissionRole,
)}
    <Container
        onClick={() => (selected = { role, defaultRole, label, sync })}
        mainAxisAlignment={"spaceBetween"}
        crossAxisAlignment={"end"}>
        <div class="label">
            <BodySmall>
                <Translatable resourceKey={label}></Translatable>
            </BodySmall>
        </div>
        {#if role !== undefined}
            <BodySmall colour={"primary"} fontWeight={"bold"} width={{ kind: "hug" }}
                >{$_(`role.${roleAsText(role)}`)}</BodySmall>
        {:else if defaultRole !== undefined}
            <BodySmall colour={"primary"} fontWeight={"bold"} width={{ kind: "hug" }}
                >{defaultText} ({$_(`role.${roleAsText(defaultRole)}`)})</BodySmall>
        {/if}
    </Container>
{/snippet}

{#snippet button(name: ResourceKey)}
    <CommonButton
        height={{ kind: "fill" }}
        width={{ kind: "fill" }}
        onClick={() => (selectedTab = name.key)}
        mode={selectedTab === name.key ? "active" : "default"}
        size={"small"}>
        <Translatable resourceKey={name}></Translatable>
    </CommonButton>
{/snippet}

{#snippet messageLevelPermissions(p: MessagePermissions, label: string)}
    {@render permissionSummary(
        i18nKey(`permissions.${label}.default`),
        (r) => (p.default = r ?? p.default),
        p.default,
    )}
    {@render permissionSummary(
        i18nKey(`permissions.${label}.text`),
        (r) => (p.text = r),
        p.text,
        p.default,
    )}
    {@render permissionSummary(
        i18nKey(`permissions.${label}.image`),
        (r) => (p.image = r),
        p.image,
        p.default,
    )}
    {@render permissionSummary(
        i18nKey(`permissions.${label}.video`),
        (r) => (p.video = r),
        p.video,
        p.default,
    )}
    {@render permissionSummary(
        i18nKey(`permissions.${label}.audio`),
        (r) => (p.audio = r),
        p.audio,
        p.default,
    )}
    {@render permissionSummary(
        i18nKey(`permissions.${label}.file`),
        (r) => (p.file = r),
        p.file,
        p.default,
    )}
    {@render permissionSummary(
        i18nKey(`permissions.${label}.poll`),
        (r) => (p.poll = r),
        p.poll,
        p.default,
    )}
    {@render permissionSummary(
        i18nKey(`permissions.${label}.crypto`),
        (r) => (p.crypto = r),
        p.crypto,
        p.default,
    )}
    {@render permissionSummary(
        i18nKey(`permissions.${label}.giphy`),
        (r) => (p.giphy = r),
        p.giphy,
        p.default,
    )}
    {@render permissionSummary(
        i18nKey(`permissions.${label}.prize`),
        (r) => (p.prize = r),
        p.prize,
        p.default,
    )}
    {@render permissionSummary(
        i18nKey(`permissions.${label}.memeFighter`),
        (r) => (p.memeFighter = r),
        p.memeFighter,
        p.default,
    )}
    {@render permissionSummary(
        i18nKey(`permissions.${label}.p2pSwap`),
        (r) => (p.p2pSwap = r),
        p.p2pSwap,
        p.default,
    )}
{/snippet}

<SlidingPageContent title={i18nKey("Permission")}>
    <Container
        height={{ kind: "fill" }}
        gap={"xxl"}
        direction={"vertical"}
        padding={["xxl", "xl", "lg", "xl"]}>
        <GroupCard candidateGroup={data.candidateGroup} />

        <Container
            height={{ kind: "fixed", size: "3rem" }}
            mainAxisAlignment={"spaceBetween"}
            padding={["zero", "zero", "sm", "zero"]}
            gap={"sm"}>
            {@render button(i18nKey("permissions.general"))}
            {@render button(i18nKey("permissions.message"))}
            {@render button(i18nKey("permissions.thread"))}
        </Container>

        <Container gap={"xxl"} direction={"vertical"}>
            {#if selectedTab === "permissions.general"}
                {@const p = data.permissions}
                {@render permissionSummary(
                    i18nKey("permissions.changeRoles"),
                    (r) => (p.changeRoles = r ?? p.changeRoles),
                    p.changeRoles,
                )}
                {@render permissionSummary(
                    i18nKey("permissions.updateGroup"),
                    (r) => (p.updateGroup = r ?? p.updateGroup),
                    p.updateGroup,
                )}

                {#if isChannel && !isCommunityPublic}
                    {@render permissionSummary(
                        i18nKey("permissions.addMembers"),
                        (r) => (p.addMembers = r ?? p.addMembers),
                        p.addMembers,
                    )}
                {/if}
                {@render permissionSummary(
                    i18nKey("permissions.inviteUsers"),
                    (r) => (p.inviteUsers = r ?? p.inviteUsers),
                    p.inviteUsers,
                )}
                {@render permissionSummary(
                    i18nKey("permissions.removeMembers"),
                    (r) => (p.removeMembers = r ?? p.removeMembers),
                    p.removeMembers,
                )}
                {@render permissionSummary(
                    i18nKey("permissions.deleteMessages"),
                    (r) => (p.deleteMessages = r ?? p.deleteMessages),
                    p.deleteMessages,
                )}
                {@render permissionSummary(
                    i18nKey("permissions.startVideoCall"),
                    (r) => (p.startVideoCall = r ?? p.startVideoCall),
                    p.startVideoCall,
                )}
                {@render permissionSummary(
                    i18nKey("permissions.pinMessages"),
                    (r) => (p.pinMessages = r ?? p.pinMessages),
                    p.pinMessages,
                )}
                {@render permissionSummary(
                    i18nKey("permissions.reactToMessages"),
                    (r) => (p.reactToMessages = r ?? p.reactToMessages),
                    p.reactToMessages,
                )}
                {@render permissionSummary(
                    i18nKey("permissions.mentionAllMembers", { mention: "@everyone" }),
                    (r) => (p.mentionAllMembers = r ?? p.mentionAllMembers),
                    p.mentionAllMembers,
                )}
            {:else if selectedTab === "permissions.message"}
                {@render messageLevelPermissions(
                    data.permissions.messagePermissions,
                    "messagePermissions",
                )}
            {:else if selectedTab === "permissions.thread"}
                <Switch
                    bind:checked={overrideChatMessages}
                    onChange={onOverrideChatMessagesChanged}>
                    <BodySmall>
                        <Translatable resourceKey={i18nKey("permissions.overrideChatMessages")} />
                    </BodySmall>
                </Switch>
                {#if data.permissions.threadPermissions !== undefined}
                    {@render messageLevelPermissions(
                        data.permissions.threadPermissions,
                        "threadPermissions",
                    )}
                {/if}
            {/if}
        </Container>

        <Container padding={["xl", "zero", "zero", "zero"]} mainAxisAlignment={"end"}>
            <CommonButton onClick={() => publish("closeModalPage")} mode="active" size={"medium"}>
                {#snippet icon(color, size)}
                    <ArrowLeft {color} {size} />
                {/snippet}
                <Translatable resourceKey={i18nKey("Done, go back")}></Translatable>
            </CommonButton>
        </Container>
    </Container>
</SlidingPageContent>

<style lang="scss">
    .label {
        text-transform: capitalize;
    }
</style>
