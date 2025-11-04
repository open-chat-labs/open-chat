<script lang="ts">
    import { i18nKey } from "@src/i18n/i18n";
    import {
        Body,
        BodySmall,
        ColourVars,
        CommonButton,
        Container,
        IconButton,
        Label,
        MenuItem,
        MenuTrigger,
    } from "component-lib";
    import { namedAccountsStore, publish, type NamedAccount } from "openchat-client";
    import Delete from "svelte-material-icons/DeleteForeverOutline.svelte";
    import DotsVertical from "svelte-material-icons/DotsVertical.svelte";
    import Plus from "svelte-material-icons/Plus.svelte";
    import Edit from "svelte-material-icons/TextBoxEditOutline.svelte";
    import Translatable from "../../Translatable.svelte";
    import SlidingPageContent from "../SlidingPageContent.svelte";

    function collapseAccount(account: string) {
        if (account.length > 23) {
            return account.slice(0, 10) + "..." + account.slice(account.length - 10);
        }
        return account;
    }

    function editAccount(account: NamedAccount) {
        publish("editRecipient", account);
    }

    function deleteAccount(_account: NamedAccount) {
        console.log("Delete account");
    }

    function addAccount() {
        publish("addRecipient");
    }
</script>

<SlidingPageContent title={i18nKey("Manage recipients")}>
    <Container gap={"lg"} padding={"lg"} direction={"vertical"}>
        <Container padding={"sm"} gap={"sm"} direction={"vertical"}>
            <Body fontWeight={"bold"}>
                <Translatable resourceKey={i18nKey("List of recipients")} />
            </Body>
            <BodySmall colour={"textSecondary"}>
                <Translatable
                    resourceKey={i18nKey(
                        "Manage your saved recipients in the list below. You will be able to access and select any recipient when sending a transaction to an address.",
                    )} />
            </BodySmall>
        </Container>
        <Container gap={"md"} direction={"vertical"}>
            {#each $namedAccountsStore as account}
                <MenuTrigger maskUI fill position={"bottom"} align={"end"}>
                    <Container
                        supplementalClass={"account_list_item"}
                        crossAxisAlignment={"center"}
                        borderColour={ColourVars.background2}
                        borderWidth={"thick"}
                        gap={"md"}
                        padding={"md"}
                        borderRadius={"md"}>
                        <Container direction={"vertical"}>
                            <Label fontWeight={"bold"}>{account.name}</Label>
                            <BodySmall colour={"textSecondary"}
                                >{collapseAccount(account.account)}</BodySmall>
                        </Container>

                        <IconButton size={"md"}>
                            {#snippet icon()}
                                <DotsVertical color={ColourVars.textSecondary} />
                            {/snippet}
                        </IconButton>
                    </Container>
                    {#snippet menuItems()}
                        <MenuItem onclick={() => editAccount(account)}>
                            {#snippet icon(color)}
                                <Edit {color} />
                            {/snippet}
                            Edit
                        </MenuItem>
                        <MenuItem danger onclick={() => deleteAccount(account)}>
                            {#snippet icon(color)}
                                <Delete {color} />
                            {/snippet}
                            Remove
                        </MenuItem>
                    {/snippet}
                </MenuTrigger>
            {/each}
        </Container>
        <Container mainAxisAlignment={"end"} crossAxisAlignment={"center"}>
            <CommonButton onClick={addAccount} mode={"active"} size={"medium"}>
                {#snippet icon(color)}
                    <Plus {color} />
                {/snippet}
                <Translatable resourceKey={i18nKey("Add recipient")}></Translatable>
            </CommonButton>
        </Container>
    </Container>
</SlidingPageContent>

<style lang="scss">
    :global(.menu_trigger_clone > .account_list_item) {
        background-color: var(--background-1) !important;
        border-color: transparent !important;
        box-shadow: var(--menu-sh);
        opacity: 1 !important;
    }
</style>
