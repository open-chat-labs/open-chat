<script lang="ts">
    import { Avatar, Button, Caption, Container, H1 } from "component-lib";
    import {
        allUsersStore,
        currentUserIdStore,
        isLifetimeDiamondStore,
        OpenChat,
        publish,
    } from "openchat-client";
    import { getContext } from "svelte";
    import UserProfileHeader from "./UserProfileHeader.svelte";

    const client = getContext<OpenChat>("client");

    let user = $derived($allUsersStore.get($currentUserIdStore));
    let name = $derived(client.getDisplayName($currentUserIdStore));
    let avatarUrl = $derived(client.userAvatarUrl(user));
</script>

<UserProfileHeader />

<Container
    padding={["xl", "lg", "zero", "lg"]}
    gap={"lg"}
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
</Container>
