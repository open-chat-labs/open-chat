<script lang="ts">
    import { Avatar, BigButton, Button, Caption, Container, H1 } from "component-lib";
    import {
        allUsersStore,
        currentUserIdStore,
        isLifetimeDiamondStore,
        OpenChat,
        publish,
    } from "openchat-client";
    import { getContext } from "svelte";
    import InformationOutline from "svelte-material-icons/InformationOutline.svelte";
    import UserProfileHeader from "./UserProfileHeader.svelte";

    type SubArea = "profile" | "general" | "advanced" | "about";

    const client = getContext<OpenChat>("client");

    let user = $derived($allUsersStore.get($currentUserIdStore));
    let name = $derived(client.getDisplayName($currentUserIdStore));
    let avatarUrl = $derived(client.userAvatarUrl(user));
    let subarea = $state<SubArea>("profile");
</script>

<UserProfileHeader />

<Container
    padding={["xl", "lg", "zero", "lg"]}
    gap={"lg"}
    height={{ kind: "fill" }}
    crossAxisAlignment={"center"}
    direction={"vertical"}>
    <Avatar size={"huge"} url={avatarUrl}></Avatar>
    <Container crossAxisAlignment={"center"} direction={"vertical"}>
        <H1 align={"center"}>{name}</H1>
        <Caption colour={"secondary"} align={"center"}>@{user?.username}</Caption>
    </Container>

    <Container crossAxisAlignment={"center"} gap={"sm"} direction={"vertical"}>
        <Button onClick={() => publish("wallet")} secondary>My Wallet</Button>
        {#if !$isLifetimeDiamondStore}
            <Button onClick={() => publish("upgrade")}>Upgrade membership</Button>
        {/if}
    </Container>

    <Container
        supplementalClass={"user_profile_summary_buttons"}
        crossAxisSelfAlignment={"end"}
        gap={"sm"}>
        <BigButton
            onClick={() => (subarea = "profile")}
            width={{ kind: "fixed", size: "5.5rem" }}
            mode={subarea === "profile" ? "active" : "default"}>
            {#snippet icon(color, size)}
                <InformationOutline {color} {size} />
            {/snippet}
            Profile
        </BigButton>
        <BigButton
            onClick={() => (subarea = "general")}
            width={{ kind: "fixed", size: "5.5rem" }}
            mode={subarea === "general" ? "active" : "default"}>
            {#snippet icon(color, size)}
                <InformationOutline {color} {size} />
            {/snippet}
            General
        </BigButton>
        <BigButton
            onClick={() => (subarea = "advanced")}
            width={{ kind: "fixed", size: "5.5rem" }}
            mode={subarea === "advanced" ? "active" : "default"}>
            {#snippet icon(color, size)}
                <InformationOutline {color} {size} />
            {/snippet}
            Advanced
        </BigButton>
        <BigButton
            onClick={() => (subarea = "about")}
            width={{ kind: "fixed", size: "5.5rem" }}
            mode={subarea === "about" ? "active" : "default"}>
            {#snippet icon(color, size)}
                <InformationOutline {color} {size} />
            {/snippet}
            About
        </BigButton>
    </Container>
</Container>

<style lang="scss">
    :global(.container.user_profile_summary_buttons) {
        margin-top: auto;
        margin-bottom: var(--sp-md);
    }
</style>
