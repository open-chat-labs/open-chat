<script lang="ts">
    import { Avatar, Container, Logo, MenuItem, SectionHeader } from "component-lib";
    import ChatOutline from "svelte-material-icons/ChatOutline.svelte";
    import CommentQuoteOutline from "svelte-material-icons/CommentQuoteOutline.svelte";
    import Flag from "svelte-material-icons/Flag.svelte";
    import Headphones from "svelte-material-icons/Headphones.svelte";
    import Translate from "svelte-material-icons/Translate.svelte";
    import Video from "svelte-material-icons/VideoOutline.svelte";
    import { fade } from "svelte/transition";

    let action = $state<string>();

    function onAction(txt: string) {
        action = txt;
        window.setTimeout(() => (action = undefined), 2000);
    }

    function onBack() {
        onAction("Back clicked");
    }

    function menuItemClicked() {
        onAction("Menu item clicked");
    }
</script>

{#snippet commonMenu()}
    <MenuItem onclick={menuItemClicked}>
        {#snippet icon(color)}
            <Headphones {color} />
        {/snippet}
        Make a call
    </MenuItem>
    <MenuItem onclick={menuItemClicked}>
        {#snippet icon(color)}
            <CommentQuoteOutline {color} />
        {/snippet}
        Quote
    </MenuItem>
    <MenuItem onclick={menuItemClicked}>
        {#snippet icon(color)}
            <ChatOutline {color} />
        {/snippet}
        Reply in thread
    </MenuItem>
    <MenuItem onclick={menuItemClicked}>
        {#snippet icon(color)}
            <Translate {color} />
        {/snippet}
        Translate
    </MenuItem>
    <MenuItem onclick={menuItemClicked}>
        {#snippet icon(color)}
            <Flag {color} />
        {/snippet}
        Report
    </MenuItem>
{/snippet}

<Container width={{ size: "500px" }}>
    <Container gap={"xl"} direction={"vertical"}>
        <SectionHeader>
            {#snippet title()}
                With OC logo
            {/snippet}
            {#snippet menu()}
                {@render commonMenu()}
            {/snippet}
            {#snippet avatar()}
                <Logo size={"lg"} />
            {/snippet}
        </SectionHeader>

        <SectionHeader onAction={() => onAction("Action clicked")} {onBack}>
            {#snippet title()}
                For direct chat
            {/snippet}
            {#snippet action(color)}
                <Video {color} />
            {/snippet}
            {#snippet menu()}
                {@render commonMenu()}
            {/snippet}
            {#snippet avatar()}
                <Avatar url={"/witch.png"} size={"lg"} />
            {/snippet}
        </SectionHeader>

        <SectionHeader>
            {#snippet title()}
                For community
            {/snippet}
            {#snippet subtitle()}
                And with a subtitle
            {/snippet}
            {#snippet menu()}
                {@render commonMenu()}
            {/snippet}
            {#snippet avatar()}
                <Avatar radius={"md"} url={"/robot.jpg"} size={"lg"} />
            {/snippet}
        </SectionHeader>

        <SectionHeader onAction={() => onAction("Action clicked")} {onBack}>
            {#snippet title()}
                For channel or group
            {/snippet}
            {#snippet subtitle()}
                And with a subtitle
            {/snippet}
            {#snippet menu()}
                {@render commonMenu()}
            {/snippet}
            {#snippet avatar()}
                <Avatar url={"/mushroom.png"} size={"lg"} />
            {/snippet}
            {#snippet action(color)}
                <Video {color} />
            {/snippet}
        </SectionHeader>

        <SectionHeader {onBack}>
            {#snippet title()}
                Basic header with label
            {/snippet}
            {#snippet menu()}
                {@render commonMenu()}
            {/snippet}
            {#snippet avatar()}
                <Avatar url={"/disco.png"} size={"lg"} />
            {/snippet}
        </SectionHeader>

        <SectionHeader {onBack}>
            {#snippet title()}
                With a really really long label that won't fit in the space without being truncated
            {/snippet}
            {#snippet subtitle()}
                And also with a really really long subtitle that also isn't going to fit without
                being truncated
            {/snippet}
            {#snippet menu()}
                {@render commonMenu()}
            {/snippet}
            {#snippet avatar()}
                <Avatar url={"/horse.png"} size={"lg"} />
            {/snippet}
        </SectionHeader>

        {#if action}
            <pre transition:fade>{action}</pre>
        {/if}
    </Container>
</Container>
