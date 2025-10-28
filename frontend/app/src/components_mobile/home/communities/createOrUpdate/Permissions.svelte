<script lang="ts">
    import { i18nKey } from "@src/i18n/i18n";
    import {
        Body,
        BodySmall,
        CommonButton,
        Container,
        Sheet,
        type SheetState,
    } from "component-lib";
    import {
        communityRoles,
        publish,
        roleAsText,
        type CommunityPermissions,
    } from "openchat-client";
    import { _ } from "svelte-i18n";
    import ArrowLeft from "svelte-material-icons/ArrowLeft.svelte";
    import Translatable from "../../../Translatable.svelte";
    import PermissionsRoleSlider from "../../PermissionsRoleSlider.svelte";
    import SlidingPageContent from "../../SlidingPageContent.svelte";
    import { updateCommunityState } from "./community.svelte";

    const ucs = updateCommunityState;

    const selectors = $derived(
        Object.keys(ucs.permissions).map<[keyof CommunityPermissions, string]>((p) => [
            p as keyof CommunityPermissions,
            `permissions.${p}`,
        ]),
    );

    let selected = $state<SheetState<[keyof CommunityPermissions, string]>>({ visible: false });
</script>

{#if selected.visible}
    {@const [key, resourceKey] = selected.data}
    <Sheet onDismiss={() => (selected.visible = false)}>
        <PermissionsRoleSlider
            height={{ kind: "fixed", size: "150px" }}
            roles={communityRoles}
            label={i18nKey(resourceKey)}
            onClose={() => (selected.visible = false)}
            bind:rolePermission={ucs.permissions[key]} />
    </Sheet>
{/if}

<SlidingPageContent title={i18nKey("Community permissions")}>
    <Container
        height={{ kind: "fill" }}
        gap={"xl"}
        direction={"vertical"}
        padding={["xxl", "xl", "lg", "xl"]}>
        <Container gap={"sm"} direction={"vertical"}>
            <Body fontWeight={"bold"}>
                <Translatable resourceKey={i18nKey("Manage community permissions")}></Translatable>
            </Body>

            <BodySmall colour={"textSecondary"}>
                <Translatable
                    resourceKey={i18nKey(
                        "You can assign permissions to different roles, from members to owners. Roles are built in a hierarchy, meaning that anyone above another role automatically gets everything that role can do.",
                    )}></Translatable>
            </BodySmall>
        </Container>
        <Container gap={"xxl"} direction={"vertical"}>
            {#each selectors as [key, resourceKey]}
                <Container
                    onClick={() => (selected = { visible: true, data: [key, resourceKey] })}
                    mainAxisAlignment={"spaceBetween"}
                    crossAxisAlignment={"end"}>
                    <div class="label">
                        <Body>
                            <Translatable resourceKey={i18nKey(resourceKey)}></Translatable>
                        </Body>
                    </div>
                    <BodySmall colour={"primary"} fontWeight={"bold"} width={{ kind: "hug" }}
                        >{$_(`role.${roleAsText(ucs.permissions[key])}`)}</BodySmall>
                </Container>
            {/each}
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
