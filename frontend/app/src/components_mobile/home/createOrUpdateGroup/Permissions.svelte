<script lang="ts">
    import { i18nKey } from "@src/i18n/i18n";
    import { Body, BodySmall, CommonButton, Container, Sheet } from "component-lib";
    import {
        type ChatPermissionRole,
        chatRoles,
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
    let selected = $state<Selected>();
    let roles = [...chatRoles];
    let isCommunityPublic = $derived($selectedCommunitySummaryStore?.public ?? true);
    let isChannel = $derived(data.candidate.id.kind === "channel");
    let selectedTab = $state("permissions.general");

    // This is because I simply cannot get the data binding to work as I *think* it should
    function syncPermission() {
        if (selected !== undefined) {
            selected.sync?.(selected.role);
            selected = undefined;
        }
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
    sync: (r: ChatPermissionRole) => void,
    role?: ChatPermissionRole,
    defaultRole?: ChatPermissionRole,
)}
    <Container
        onClick={() => (selected = { role, defaultRole, label, sync })}
        mainAxisAlignment={"spaceBetween"}
        crossAxisAlignment={"end"}>
        <div class="label">
            <Body>
                <Translatable resourceKey={label}></Translatable>
            </Body>
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
        width={{ kind: "fill" }}
        onClick={() => (selectedTab = name.key)}
        mode={selectedTab === name.key ? "active" : "default"}
        size={"small"}>
        <Translatable resourceKey={name}></Translatable>
    </CommonButton>
{/snippet}

<SlidingPageContent title={i18nKey("Permission")}>
    <Container
        height={{ kind: "fill" }}
        gap={"xxl"}
        direction={"vertical"}
        padding={["xxl", "xl", "lg", "xl"]}>
        <GroupCard candidateGroup={data.candidateGroup} />

        <Container mainAxisAlignment={"spaceBetween"} padding={["sm", "zero"]} gap={"sm"}>
            {@render button(i18nKey("permissions.general"))}
            {@render button(i18nKey("permissions.message"))}
            {@render button(i18nKey("permissions.thread"))}
        </Container>

        <Container gap={"xxl"} direction={"vertical"}>
            {#if selectedTab === "permissions.general"}
                {@const p = data.permissions}
                {@render permissionSummary(
                    i18nKey("permissions.changeRoles"),
                    (r) => (p.changeRoles = r),
                    p.changeRoles,
                )}
                {@render permissionSummary(
                    i18nKey("permissions.updateGroup"),
                    (r) => (p.updateGroup = r),
                    p.updateGroup,
                )}

                {#if isChannel && !isCommunityPublic}
                    {@render permissionSummary(
                        i18nKey("permissions.addMembers"),
                        (r) => (p.addMembers = r),
                        p.addMembers,
                    )}
                {/if}
                {@render permissionSummary(
                    i18nKey("permissions.inviteUsers"),
                    (r) => (p.inviteUsers = r),
                    p.inviteUsers,
                )}
                {@render permissionSummary(
                    i18nKey("permissions.removeMembers"),
                    (r) => (p.removeMembers = r),
                    p.removeMembers,
                )}
                {@render permissionSummary(
                    i18nKey("permissions.deleteMessages"),
                    (r) => (p.deleteMessages = r),
                    p.deleteMessages,
                )}
                {@render permissionSummary(
                    i18nKey("permissions.startVideoCall"),
                    (r) => (p.startVideoCall = r),
                    p.startVideoCall,
                )}
                {@render permissionSummary(
                    i18nKey("permissions.pinMessages"),
                    (r) => (p.pinMessages = r),
                    p.pinMessages,
                )}
                {@render permissionSummary(
                    i18nKey("permissions.reactToMessages"),
                    (r) => (p.reactToMessages = r),
                    p.reactToMessages,
                )}
                {@render permissionSummary(
                    i18nKey("permissions.mentionAllMembers", { mention: "@everyone" }),
                    (r) => (p.mentionAllMembers = r),
                    p.mentionAllMembers,
                )}
            {:else if selectedTab === "permissions.message"}
                {@const p = data.permissions.messagePermissions}
                {@render permissionSummary(
                    i18nKey("permissions.messagePermissions.default"),
                    (r) => (p.default = r),
                    p.default,
                )}
                {@render permissionSummary(
                    i18nKey("permissions.messagePermissions.text"),
                    (r) => (p.text = r),
                    p.text,
                    p.default,
                )}
                {@render permissionSummary(
                    i18nKey("permissions.messagePermissions.image"),
                    (r) => (p.image = r),
                    p.image,
                    p.default,
                )}
                {@render permissionSummary(
                    i18nKey("permissions.messagePermissions.video"),
                    (r) => (p.video = r),
                    p.video,
                    p.default,
                )}
            {:else if selectedTab === "permissions.thread"}{/if}
        </Container>

        <Container padding={["xl", "zero", "zero", "zero"]} mainAxisAlignment={"end"}>
            <CommonButton onClick={() => publish("closeModalPage")} mode="active" size={"medium"}>
                {#snippet icon(color)}
                    <ArrowLeft {color} />
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
