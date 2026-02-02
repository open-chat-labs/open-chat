<script lang="ts">
    import { i18nKey } from "@i18n/i18n";
    import { Body, BodySmall, ColourVars, Container, Sheet, Subtitle, Select } from "component-lib";
    import ChevronRight from "svelte-material-icons/ChevronRight.svelte";
    import ChevronDown from "svelte-material-icons/ChevronDown.svelte";
    import Translatable from "../Translatable.svelte";

    type Props = {
        networks: string[];
        selectedNetwork?: string;
        background?: string;
        flatSelect?: boolean;
    };

    type NetworkInfo = {
        name: string;
        info: string;
    };

    const networkInfo: Record<string, NetworkInfo> = {
        arbitrum: {
            name: "Arbitrum network",
            info: "This is some information about what the Arbitrum network is all about and what it means. Blah blah blah and there we are.",
        },
        base: {
            name: "Base network",
            info: "This is some information about what the Base network is all about and what it means. Blah blah blah and there we are.",
        },
        btc: {
            name: "BTC network",
            info: "This is some information about what the BTC network is all about and what it means. Blah blah blah and there we are.",
        },
        ckbtc: {
            name: "ckBTC network",
            info: "This is some information about what the ckBTC network is all about and what it means. Blah blah blah and there we are.",
        },
        icp: {
            name: "ICP network",
            info: "Transfers USDT as a native token on the Internet Computer, enabling fast, low-cost transactions directly on-chain without gas fees from external networks.",
        },
        ethereum: {
            name: "Ethereum network",
            info: "Transfers USDT as an ERC-20 token on Ethereum, offering wide compatibility with wallets and exchanges but typically higher gas fees and slower confirmations.",
        },
    };

    let {
        networks,
        selectedNetwork = $bindable(),
        background,
        flatSelect = false,
    }: Props = $props();

    let showSheet = $state(false);
</script>

{#snippet selectOptions(onSelect: (val: string) => void)}
    <Container
        onClick={(e) => e?.stopPropagation()}
        height={{ size: "100%" }}
        supplementalClass={"language_options"}
        padding={["lg", "xl", "huge"]}
        gap={"xxl"}
        direction={"vertical"}>
        <Subtitle fontWeight={"bold"}>
            <Translatable resourceKey={i18nKey("Select token network")}></Translatable>
        </Subtitle>

        <Container gap={"xxl"} supplementalClass={"binding_options"} direction={"vertical"}>
            {#each networks as network}
                {@const { info, name } = networkInfo[network.toLowerCase()]}
                <Container
                    onClick={() => onSelect(network)}
                    gap={"sm"}
                    crossAxisAlignment={"center"}
                    direction={"vertical"}>
                    <Container>
                        <Body fontWeight={"bold"} colour={"primary"}>{name}</Body>
                        <ChevronRight color={ColourVars.primary} />
                    </Container>
                    <Body colour={"textSecondary"}>
                        {info}
                    </Body>
                </Container>
            {/each}
        </Container>
    </Container>
{/snippet}

{#if flatSelect}
    <Container
        {background}
        padding={["lg", "xl"]}
        direction="horizontal"
        crossAxisAlignment="center">
        <Container
            direction="vertical"
            width="fill"
            gap="xs"
            onClick={() => {
                showSheet = true;
            }}>
            <BodySmall colour={"textSecondary"} fontWeight={"bold"}>
                <Translatable resourceKey={i18nKey("tokenTransfer.selectTransferNetwork")} />
            </BodySmall>
            <Container crossAxisAlignment="end" gap="sm">
                <Subtitle width="hug" fontWeight="bold">{selectedNetwork}</Subtitle>
            </Container>
        </Container>
        <ChevronDown size="1.25rem" color={ColourVars.primary} />
    </Container>

    {#if showSheet}
        <Sheet
            onDismiss={() => {
                showSheet = false;
            }}>
            {@render selectOptions((val) => {
                selectedNetwork = val;
                showSheet = false;
            })}
        </Sheet>
    {/if}
{:else}
    <Select
        onSelect={(val) => (selectedNetwork = val)}
        placeholder={"Token networks"}
        value={selectedNetwork}
        {selectOptions}>
        {#snippet subtext()}
            <Translatable resourceKey={i18nKey("Select your token transfer network")}
            ></Translatable>
        {/snippet}
        {#snippet selectedValue(val)}
            {val}
        {/snippet}
    </Select>
{/if}
