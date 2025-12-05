<script lang="ts">
    import { CommonButton, Container, User } from "component-lib";
    import ForwardIcon from "svelte-material-icons/Share.svelte";
    import DebugEvent from "./DebugEvent.svelte";

    function userClicked(onAction: (action: string) => void) {
        return () => onAction("User clicked");
    }

    function inviteClicked(onAction: (action: string) => void) {
        return () => onAction("Invite clicked");
    }
</script>

{#snippet user(
    title: string,
    subtitle: string,
    avatarUrl: string,
    onAction: (txt: string) => void,
    invite: boolean = false,
)}
    <User {title} {subtitle} onClick={userClicked(onAction)} {avatarUrl}>
        {#snippet button()}
            {#if invite}
                <CommonButton onClick={inviteClicked(onAction)} mode={"active"} size={"small_text"}>
                    {#snippet icon(color, size)}
                        <ForwardIcon {color} {size} />
                    {/snippet}
                    Invite
                </CommonButton>
            {/if}
        {/snippet}
    </User>
{/snippet}

<DebugEvent>
    {#snippet children(onAction)}
        <Container width={{ size: "500px" }}>
            <Container gap={"xxl"} direction={"vertical"}>
                {@render user("Contact Name", "@Username", "/witch.png", onAction)}
                {@render user("Julian Jelfs", "@julian_jelfs", "/mushroom.png", onAction)}
                {@render user(
                    "Contact with a really really really really really long name",
                    "+44 7000 123456",
                    "/robot.jpg",
                    onAction,
                    true,
                )}
                {@render user("Contact Name", "+44 7000 123456", "/robot.jpg", onAction, true)}
            </Container>
        </Container>
    {/snippet}
</DebugEvent>
