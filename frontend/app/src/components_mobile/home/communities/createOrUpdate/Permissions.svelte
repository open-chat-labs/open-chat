<script lang="ts">
    import { i18nKey } from "@src/i18n/i18n";
    import { CommonButton, Container } from "component-lib";
    import { communityRoles, publish, type CommunityPermissions } from "openchat-client";
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
</script>

<SlidingPageContent title={i18nKey("Community permissions")}>
    <Container
        height={{ kind: "fill" }}
        gap={"xl"}
        direction={"vertical"}
        padding={["xxl", "md", "lg", "md"]}>
        <Container gap={"lg"} direction={"vertical"}>
            {#each selectors as [key, resourceKey]}
                <PermissionsRoleSlider
                    roles={communityRoles}
                    label={i18nKey(resourceKey)}
                    bind:rolePermission={ucs.permissions[key]} />
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
