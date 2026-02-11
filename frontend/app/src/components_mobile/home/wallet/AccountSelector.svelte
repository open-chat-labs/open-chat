<script lang="ts">
    import {
        Body,
        Column,
        Container,
        DefaultAvatar,
        Option,
        Search,
        Sheet,
        Subtitle,
    } from "component-lib";
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
        supplementalClass={"account_selector"}
        padding={["lg", "zero", "zero"]}
        gap={"xxl"}
        direction={"vertical"}>
        <Container padding={["zero", "xxl"]} crossAxisAlignment={"center"}>
            <Subtitle fontWeight={"bold"}>
                <Translatable resourceKey={i18nKey("Select saved address")}></Translatable>
            </Subtitle>
        </Container>

        <Column gap="xs">
            <Container padding={["zero", "lg"]}>
                <Search
                    {searching}
                    id={"search_component"}
                    placeholder={"Find address..."}
                    bind:value={searchTerm} />
            </Container>

            <Container
                supplementalClass={"token_selector"}
                direction={"vertical"}
                padding={["xxl", "lg", "huge"]}
                overflow="auto"
                maxHeight="60vh"
                gap="md">
                {#each filteredAccounts as account}
                    <Option
                        padding={["sm", "lg", "sm", "sm"]}
                        selected={account.account === targetAccount}
                        value={account}
                        onClick={() => selectAccount(account)}>
                        <Container gap="md" overflow="hidden" crossAxisAlignment="center">
                            <DefaultAvatar
                                icon="recipient"
                                size="md"
                                name={account.name}
                                variant="filled" />
                            <Column>
                                <Subtitle fontWeight={"bold"}>{account.name}</Subtitle>
                                <Body ellipsisTruncate colour={"textSecondary"}
                                    >{collapseAccount(account.account)}</Body>
                            </Column>
                        </Container>
                    </Option>
                {/each}
            </Container>
        </Column>
    </Container>
</Sheet>
