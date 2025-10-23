<script lang="ts">
    import { i18nKey } from "@src/i18n/i18n";
    import { CommonButton, Container } from "component-lib";
    import { chatRoles, publish, selectedCommunitySummaryStore } from "openchat-client";
    import ArrowLeft from "svelte-material-icons/ArrowLeft.svelte";
    import Translatable from "../../Translatable.svelte";
    import GroupCard from "../createOrUpdateGroup/GroupCard.svelte";
    import PermissionsRoleSlider from "../PermissionsRoleSlider.svelte";
    import SlidingPageContent from "../SlidingPageContent.svelte";
    import { updateGroupState } from "./group.svelte";

    const data = updateGroupState;
    let roles = [...chatRoles];
    let isCommunityPublic = $derived($selectedCommunitySummaryStore?.public ?? true);
    let isChannel = $derived(data.candidate.id.kind === "channel");
</script>

<SlidingPageContent title={i18nKey("Permission")}>
    <Container
        height={{ kind: "fill" }}
        gap={"xl"}
        direction={"vertical"}
        padding={["xxl", "lg", "lg", "lg"]}>
        <GroupCard candidateGroup={data.candidateGroup} />

        <Container gap={"lg"} direction={"vertical"}>
            <PermissionsRoleSlider
                {roles}
                label={i18nKey("permissions.changeRoles")}
                bind:rolePermission={data.permissions.changeRoles} />
            <PermissionsRoleSlider
                {roles}
                label={i18nKey("permissions.updateGroup")}
                bind:rolePermission={data.permissions.updateGroup} />
            {#if isChannel && !isCommunityPublic}
                <PermissionsRoleSlider
                    {roles}
                    label={i18nKey("permissions.addMembers")}
                    bind:rolePermission={data.permissions.addMembers} />
            {/if}
            <PermissionsRoleSlider
                {roles}
                label={i18nKey("permissions.inviteUsers")}
                bind:rolePermission={data.permissions.inviteUsers} />
            <PermissionsRoleSlider
                {roles}
                label={i18nKey("permissions.removeMembers")}
                bind:rolePermission={data.permissions.removeMembers} />
            <PermissionsRoleSlider
                {roles}
                label={i18nKey("permissions.deleteMessages")}
                bind:rolePermission={data.permissions.deleteMessages} />
            <PermissionsRoleSlider
                {roles}
                label={i18nKey("permissions.startVideoCall")}
                bind:rolePermission={data.permissions.startVideoCall} />
            <PermissionsRoleSlider
                {roles}
                label={i18nKey("permissions.pinMessages")}
                bind:rolePermission={data.permissions.pinMessages} />
            <PermissionsRoleSlider
                {roles}
                label={i18nKey("permissions.reactToMessages")}
                bind:rolePermission={data.permissions.reactToMessages} />
            <PermissionsRoleSlider
                {roles}
                label={i18nKey("permissions.mentionAllMembers", { mention: "@everyone" })}
                bind:rolePermission={data.permissions.mentionAllMembers} />
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
