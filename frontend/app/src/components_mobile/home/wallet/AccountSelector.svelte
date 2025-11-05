<script lang="ts">
    import { BodySmall, Container, Label, Option, Search, Sheet, Subtitle } from "component-lib";
    import { namedAccountsStore, type NamedAccount } from "openchat-client";
    import { i18nKey } from "../../../i18n/i18n";
    import Translatable from "../../Translatable.svelte";

    interface Props {
        targetAccount: string;
        onDismiss: () => void;
    }

    let { targetAccount = $bindable(), onDismiss }: Props = $props();
    let searching = $state(false);
    let searchTerm = $state<string>("");
    let searchTermLower = $derived(searchTerm?.toLowerCase());
    let filteredAccounts = $derived(
        $namedAccountsStore.filter(
            ({ account, name }) =>
                searchTermLower === "" ||
                name.toLowerCase().includes(searchTermLower) ||
                account.toLowerCase().includes(searchTermLower),
        ),
    );

    function collapseAccount(account: string) {
        if (account.length > 23) {
            return account.slice(0, 10) + "..." + account.slice(account.length - 10);
        }
        return account;
    }

    function selectAccount(namedAccount: NamedAccount) {
        targetAccount = namedAccount.account;
        onDismiss();
    }
</script>

<Sheet {onDismiss}>
    <Container
        height={{ kind: "fixed", size: "100%" }}
        supplementalClass={"account_selector"}
        padding={"lg"}
        gap={"xl"}
        direction={"vertical"}>
        <Container padding={["zero", "sm"]} gap={"md"} crossAxisAlignment={"center"}>
            <Subtitle fontWeight={"bold"}>
                <Translatable resourceKey={i18nKey("Select saved address")}></Translatable>
            </Subtitle>
        </Container>

        <Search
            {searching}
            id={"search_component"}
            placeholder={"Find address..."}
            bind:value={searchTerm} />

        <Container supplementalClass={"token_selector"} direction={"vertical"}>
            {#each filteredAccounts as account}
                <Option
                    padding={["sm", "lg", "sm", "xxl"]}
                    selected={account.account === targetAccount}
                    value={account}
                    onClick={() => selectAccount(account)}>
                    <Container direction={"vertical"}>
                        <Label fontWeight={"bold"}>{collapseAccount(account.name)}</Label>
                        <BodySmall ellipsisTruncate colour={"textSecondary"}
                            >{account.account}</BodySmall>
                    </Container>
                </Option>
            {/each}
        </Container>
    </Container>
</Sheet>
