<script lang="ts">
    import { i18nKey } from "@src/i18n/i18n";
    import { Body, BodySmall, CommonButton, Container, Sheet } from "component-lib";
    import {
        type ChatPermissions,
        chatRoles,
        type MemberRole,
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

    type JustChatPermissions = Exclude<
        keyof ChatPermissions,
        "messagePermissions" | "threadPermissions"
    >;
    const data = updateGroupState;
    let roles = [...chatRoles];
    let isCommunityPublic = $derived($selectedCommunitySummaryStore?.public ?? true);
    let isChannel = $derived(data.candidate.id.kind === "channel");
    let selected = $state<[JustChatPermissions, ResourceKey]>();
</script>

{#if selected !== undefined}
    {@const [key, resourceKey] = selected}
    <Sheet onDismiss={() => (selected = undefined)}>
        <PermissionsRoleSlider
            height={{ kind: "fixed", size: "250px" }}
            {roles}
            label={resourceKey}
            onClose={() => (selected = undefined)}
            bind:rolePermission={data.permissions[key]} />
    </Sheet>
{/if}

{#snippet permissionSummary(key: JustChatPermissions, resourceKey: ResourceKey)}
    <Container
        onClick={() => (selected = [key, resourceKey])}
        mainAxisAlignment={"spaceBetween"}
        crossAxisAlignment={"end"}>
        <div class="label">
            <Body>
                <Translatable {resourceKey}></Translatable>
            </Body>
        </div>
        <BodySmall colour={"primary"} fontWeight={"bold"} width={{ kind: "hug" }}
            >{$_(`role.${roleAsText(data.permissions[key] as MemberRole)}`)}</BodySmall>
    </Container>
{/snippet}

<SlidingPageContent title={i18nKey("Permission")}>
    <Container
        height={{ kind: "fill" }}
        gap={"xxl"}
        direction={"vertical"}
        padding={["xxl", "xl", "lg", "xl"]}>
        <GroupCard candidateGroup={data.candidateGroup} />

        <Container gap={"xxl"} direction={"vertical"}>
            {@render permissionSummary("changeRoles", i18nKey("permissions.changeRoles"))}
            {@render permissionSummary("updateGroup", i18nKey("permissions.updateGroup"))}

            {#if isChannel && !isCommunityPublic}
                {@render permissionSummary("addMembers", i18nKey("permissions.addMembers"))}
            {/if}
            {@render permissionSummary("inviteUsers", i18nKey("permissions.inviteUsers"))}
            {@render permissionSummary("removeMembers", i18nKey("permissions.removeMembers"))}
            {@render permissionSummary("deleteMessages", i18nKey("permissions.deleteMessages"))}
            {@render permissionSummary("startVideoCall", i18nKey("permissions.startVideoCall"))}
            {@render permissionSummary("pinMessages", i18nKey("permissions.pinMessages"))}
            {@render permissionSummary("reactToMessages", i18nKey("permissions.reactToMessages"))}
            {@render permissionSummary(
                "mentionAllMembers",
                i18nKey("permissions.mentionAllMembers", { mention: "@everyone" }),
            )}
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
