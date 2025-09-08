<script lang="ts">
    import { Avatar, Container, Logo, MenuItem, SectionHeader } from "component-lib";
    import ChatOutline from "svelte-material-icons/ChatOutline.svelte";
    import CommentQuoteOutline from "svelte-material-icons/CommentQuoteOutline.svelte";
    import Flag from "svelte-material-icons/Flag.svelte";
    import Headphones from "svelte-material-icons/Headphones.svelte";
    import Translate from "svelte-material-icons/Translate.svelte";
    import { fade } from "svelte/transition";

    let action = $state<string>();

    function onBack() {
        action = "Back clicked";
        window.setTimeout(() => (action = undefined), 2000);
    }
</script>

{#snippet commonMenu()}
    <MenuItem>
        {#snippet icon(color)}
            <Headphones {color} />
        {/snippet}
        Make a call
    </MenuItem>
    <MenuItem>
        {#snippet icon(color)}
            <CommentQuoteOutline {color} />
        {/snippet}
        Quote
    </MenuItem>
    <MenuItem>
        {#snippet icon(color)}
            <ChatOutline {color} />
        {/snippet}
        Reply in thread
    </MenuItem>
    <MenuItem>
        {#snippet icon(color)}
            <Translate {color} />
        {/snippet}
        Translate
    </MenuItem>
    <MenuItem>
        {#snippet icon(color)}
            <Flag {color} />
        {/snippet}
        Report
    </MenuItem>
{/snippet}

<Container width={{ kind: "fixed", size: "500px" }}>
    <Container gap={"xl"} direction={"vertical"}>
        <SectionHeader title={"With OC logo"}>
            {#snippet menu()}
                {@render commonMenu()}
            {/snippet}
            {#snippet avatar()}
                <Logo size={"lg"} />
            {/snippet}
        </SectionHeader>

        <SectionHeader title={"For direct chat"} {onBack}>
            {#snippet menu()}
                {@render commonMenu()}
            {/snippet}
            {#snippet avatar()}
                <Avatar url={"/witch.png"} size={"lg"} />
            {/snippet}
        </SectionHeader>

        <SectionHeader title={"For community"} subtitle={"And with a subtitle"}>
            {#snippet menu()}
                {@render commonMenu()}
            {/snippet}
            {#snippet avatar()}
                <Avatar radius={"md"} url={"/robot.jpg"} size={"lg"} />
            {/snippet}
        </SectionHeader>

        <SectionHeader {onBack} title={"For channel or group"} subtitle={"And with a subtitle"}>
            {#snippet menu()}
                {@render commonMenu()}
            {/snippet}
            {#snippet avatar()}
                <Avatar url={"/mushroom.png"} size={"lg"} />
            {/snippet}
        </SectionHeader>

        <SectionHeader {onBack} title={"Basic header with label"}>
            {#snippet menu()}
                {@render commonMenu()}
            {/snippet}
            {#snippet avatar()}
                <Avatar url={"/disco.png"} size={"lg"} />
            {/snippet}
        </SectionHeader>

        <SectionHeader
            {onBack}
            title={"With a really really long label that won't fit in the space without being truncated"}
            subtitle={"And also with a really really long subtitle that also isn't going to fit without being truncated"}>
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
