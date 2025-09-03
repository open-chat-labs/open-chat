<script lang="ts">
    import { CommonButton, Container, H2, MenuItem, MenuTrigger } from "component-lib";
    import ChatOutline from "svelte-material-icons/ChatOutline.svelte";
    import CommentQuoteOutline from "svelte-material-icons/CommentQuoteOutline.svelte";
    import Flag from "svelte-material-icons/Flag.svelte";
    import Headphones from "svelte-material-icons/Headphones.svelte";
    import Burger from "svelte-material-icons/Menu.svelte";
    import Translate from "svelte-material-icons/Translate.svelte";

    function showMenu() {
        console.log("show menu");
    }

    function menuItemClicked() {}
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

<Container gap={"xl"} direction={"vertical"}>
    <H2>Context menus</H2>

    <Container
        height={{ kind: "fixed", size: "300px" }}
        mainAxisAlignment={"spaceBetween"}
        gap="lg">
        <MenuTrigger position={"bottom"} align={"middle"}>
            <CommonButton mode={"active"} onClick={showMenu}>
                {#snippet icon(color)}
                    <Burger {color} />
                {/snippet}
                Bottom middle
            </CommonButton>
            {#snippet menuItems()}
                {@render commonMenu()}
            {/snippet}
        </MenuTrigger>

        <MenuTrigger position={"bottom"} align={"middle"}>
            <CommonButton mode={"active"} onClick={showMenu}>
                {#snippet icon(color)}
                    <Burger {color} />
                {/snippet}
                Bottom middle
            </CommonButton>
            {#snippet menuItems()}
                {@render commonMenu()}
            {/snippet}
        </MenuTrigger>
    </Container>

    <Container
        height={{ kind: "fixed", size: "300px" }}
        mainAxisAlignment={"spaceBetween"}
        gap="lg">
        <MenuTrigger position={"right"} align={"start"}>
            <CommonButton mode={"active"} onClick={showMenu}>
                {#snippet icon(color)}
                    <Burger {color} />
                {/snippet}
                Right start
            </CommonButton>
            {#snippet menuItems()}
                {@render commonMenu()}
            {/snippet}
        </MenuTrigger>

        <MenuTrigger position={"left"} align={"end"}>
            <CommonButton mode={"active"} onClick={showMenu}>
                {#snippet icon(color)}
                    <Burger {color} />
                {/snippet}
                Left end
            </CommonButton>
            {#snippet menuItems()}
                {@render commonMenu()}
            {/snippet}
        </MenuTrigger>
    </Container>

    <Container
        height={{ kind: "fixed", size: "300px" }}
        mainAxisAlignment={"spaceBetween"}
        gap="lg">
        <MenuTrigger position={"top"} align={"start"}>
            <CommonButton mode={"active"} onClick={showMenu}>
                {#snippet icon(color)}
                    <Burger {color} />
                {/snippet}
                Top start
            </CommonButton>
            {#snippet menuItems()}
                {@render commonMenu()}
            {/snippet}
        </MenuTrigger>

        <MenuTrigger position={"top"} align={"start"}>
            <CommonButton mode={"active"} onClick={showMenu}>
                {#snippet icon(color)}
                    <Burger {color} />
                {/snippet}
                Top start
            </CommonButton>
            {#snippet menuItems()}
                {@render commonMenu()}
            {/snippet}
        </MenuTrigger>
    </Container>
</Container>
