<script lang="ts">
    import { CommonButton, Container, H2, MenuItem, MenuTrigger } from "component-lib";
    import ChatOutline from "svelte-material-icons/ChatOutline.svelte";
    import CommentQuoteOutline from "svelte-material-icons/CommentQuoteOutline.svelte";
    import Flag from "svelte-material-icons/Flag.svelte";
    import Headphones from "svelte-material-icons/Headphones.svelte";
    import Burger from "svelte-material-icons/Menu.svelte";
    import Translate from "svelte-material-icons/Translate.svelte";
    import { fade } from "svelte/transition";

    let nameClicked = $state();

    function showMenu() {
        console.log("show menu");
    }

    function menuItemClicked(name: string) {
        nameClicked = name;
        window.setTimeout(() => (nameClicked = undefined), 2000);
    }
</script>

{#snippet commonMenu()}
    <MenuItem onclick={() => menuItemClicked("Make a call")}>
        {#snippet icon(color)}
            <Headphones {color} />
        {/snippet}
        Make a call
    </MenuItem>
    <MenuItem onclick={() => menuItemClicked("Quote")}>
        {#snippet icon(color)}
            <CommentQuoteOutline {color} />
        {/snippet}
        Quote
    </MenuItem>
    <MenuItem onclick={() => menuItemClicked("Reply in thread")}>
        {#snippet icon(color)}
            <ChatOutline {color} />
        {/snippet}
        Reply in thread
    </MenuItem>
    <MenuItem onclick={() => menuItemClicked("Translate")}>
        {#snippet icon(color)}
            <Translate {color} />
        {/snippet}
        Translate
    </MenuItem>
    <MenuItem onclick={() => menuItemClicked("Report")}>
        {#snippet icon(color)}
            <Flag {color} />
        {/snippet}
        Report
    </MenuItem>
{/snippet}

<Container gap={"xl"} direction={"vertical"}>
    <H2>Context menus</H2>

    <Container height={{ size: "300px" }} mainAxisAlignment={"spaceBetween"} gap="lg">
        <MenuTrigger position={"bottom"} align={"middle"}>
            <CommonButton size={"large"} mode={"active"}>
                {#snippet icon(color, size)}
                    <Burger {color} {size} />
                {/snippet}
                Bottom middle
            </CommonButton>
            {#snippet menuItems()}
                {@render commonMenu()}
            {/snippet}
        </MenuTrigger>

        <MenuTrigger position={"bottom"} align={"middle"}>
            <CommonButton size={"large"} mode={"active"}>
                {#snippet icon(color, size)}
                    <Burger {color} {size} />
                {/snippet}
                Bottom middle
            </CommonButton>
            {#snippet menuItems()}
                {@render commonMenu()}
            {/snippet}
        </MenuTrigger>
    </Container>

    <Container height={{ size: "300px" }} mainAxisAlignment={"spaceBetween"} gap="lg">
        <MenuTrigger position={"right"} align={"start"}>
            <CommonButton size={"large"} mode={"active"}>
                {#snippet icon(color, size)}
                    <Burger {color} {size} />
                {/snippet}
                Right start
            </CommonButton>
            {#snippet menuItems()}
                {@render commonMenu()}
            {/snippet}
        </MenuTrigger>

        <MenuTrigger position={"left"} align={"end"}>
            <CommonButton size={"large"} mode={"active"}>
                {#snippet icon(color, size)}
                    <Burger {color} {size} />
                {/snippet}
                Left end
            </CommonButton>
            {#snippet menuItems()}
                {@render commonMenu()}
            {/snippet}
        </MenuTrigger>
    </Container>

    <Container height={{ size: "300px" }} mainAxisAlignment={"spaceBetween"} gap="lg">
        <MenuTrigger position={"top"} align={"start"}>
            <CommonButton size={"large"} mode={"active"}>
                {#snippet icon(color, size)}
                    <Burger {color} {size} />
                {/snippet}
                Top start
            </CommonButton>
            {#snippet menuItems()}
                {@render commonMenu()}
            {/snippet}
        </MenuTrigger>

        <MenuTrigger position={"top"} align={"start"}>
            <CommonButton size={"large"} mode={"active"}>
                {#snippet icon(color, size)}
                    <Burger {color} {size} />
                {/snippet}
                Top start
            </CommonButton>
            {#snippet menuItems()}
                {@render commonMenu()}
            {/snippet}
        </MenuTrigger>
    </Container>

    {#if nameClicked}
        <pre transition:fade>{`${nameClicked} clicked!`}</pre>
    {/if}
</Container>
