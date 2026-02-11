<script lang="ts">
    import { i18nKey } from "@src/i18n/i18n";
    import {
        Body,
        ColourVars,
        Container,
        FloatingButton,
        IconButton,
        Label,
        MenuItem,
        MenuTrigger,
        Spinner,
        Subtitle,
        DefaultAvatar,
    } from "component-lib";
    import { namedAccountsStore, OpenChat, publish, type NamedAccount } from "openchat-client";
    import { getContext } from "svelte";
    import Delete from "svelte-material-icons/DeleteForeverOutline.svelte";
    import DotsVertical from "svelte-material-icons/DotsVertical.svelte";
    import Plus from "svelte-material-icons/Plus.svelte";
    import Edit from "svelte-material-icons/TextBoxEditOutline.svelte";
    import Translatable from "../../Translatable.svelte";
    import SlidingPageContent from "../SlidingPageContent.svelte";

    const client = getContext<OpenChat>("client");

    let deleting = $state<string>();

    function editAccount(account: NamedAccount) {
        publish("editRecipient", { account, onComplete: () => publish("closeModalPage") });
    }

    async function deleteAccount({ account }: NamedAccount) {
        deleting = account;
        const res = await client.deleteCryptoAccount(account);
        if (res.kind === "success") {
            const accts = await client.loadSavedCryptoAccounts();
            namedAccountsStore.set(accts);
        }
        deleting = undefined;
    }

    function addAccount() {
        publish("addRecipient", { onComplete: () => publish("closeModalPage") });
    }
</script>

<SlidingPageContent title={i18nKey("Manage recipients")}>
    <Container height={"fill"} gap={"lg"} padding={"lg"} direction={"vertical"}>
        <Container padding={"sm"} gap={"sm"} direction={"vertical"}>
            <Subtitle fontWeight={"bold"}>
                <Translatable resourceKey={i18nKey("List of recipients")} />
            </Subtitle>
            <Body colour={"textSecondary"}>
                <Translatable
                    resourceKey={i18nKey(
                        "Manage your saved recipients in the list below. You will be able to access and select any recipient when sending a transaction to an address.",
                    )} />
            </Body>
        </Container>
        {#if $namedAccountsStore.length > 0}
            <Container closeMenuOnScroll height={"fill"} gap={"md"} direction={"vertical"}>
                {#each $namedAccountsStore as account}
                    <MenuTrigger maskUI fill position={"bottom"} align={"end"}>
                        <Container
                            supplementalClass={"account_list_item"}
                            crossAxisAlignment={"center"}
                            borderColour={ColourVars.background2}
                            borderWidth={"thick"}
                            gap={"md"}
                            padding={["md", "xs", "md", "lg"]}
                            borderRadius={"lg"}>
                            <Container width={{ size: "3rem" }}>
                                <DefaultAvatar
                                    name={account.name}
                                    size="lg"
                                    icon="recipient"
                                    variant="outlined" />
                            </Container>

                            <Container direction={"vertical"} gap="xs">
                                <Label fontWeight={"bold"}>{account.name}</Label>
                                <Body ellipsisTruncate colour={"textSecondary"}
                                    >{account.account}</Body>
                            </Container>

                            <IconButton size={"md"}>
                                {#snippet icon()}
                                    {#if deleting === account.account}
                                        <span class="busy_icon">
                                            <Spinner
                                                backgroundColour={ColourVars.textTertiary}
                                                foregroundColour={ColourVars.textSecondary} />
                                        </span>
                                    {:else}
                                        <DotsVertical color={ColourVars.textSecondary} />
                                    {/if}
                                {/snippet}
                            </IconButton>
                        </Container>
                        {#snippet menuItems()}
                            <MenuItem onclick={() => editAccount(account)}>
                                {#snippet icon(color, size)}
                                    <Edit {color} {size} />
                                {/snippet}
                                Edit
                            </MenuItem>
                            <MenuItem danger onclick={() => deleteAccount(account)}>
                                {#snippet icon(color, size)}
                                    <Delete {color} {size} />
                                {/snippet}
                                Remove
                            </MenuItem>
                        {/snippet}
                    </MenuTrigger>
                {/each}
            </Container>
        {/if}
    </Container>
    <FloatingButton pos={{ bottom: "xxl", right: "xl" }} onClick={addAccount}>
        {#snippet icon(color)}
            <Plus {color} />
        {/snippet}
    </FloatingButton>
</SlidingPageContent>

<style lang="scss">
    :global(.menu_trigger_clone > .account_list_item) {
        background-color: var(--background-1) !important;
        border-color: transparent !important;
        box-shadow: var(--menu-sh);
        opacity: 1 !important;
        transition: opacity 250ms ease-out;
    }

    // TODO do we move this to MenuTrigger.svelte?
    :global(.menu_trigger_clone.fadeout > .account_list_item) {
        opacity: 0 !important;
    }

    .busy_icon {
        display: flex;
    }
</style>
