<script lang="ts">
    import {
        Container,
        Form,
        Input,
        InputIconButton,
        InputTextButton,
        Label,
        Search,
    } from "component-lib";
    import Account from "svelte-material-icons/Account.svelte";
    import Magnify from "svelte-material-icons/Magnify.svelte";
    import QrCodeScan from "svelte-material-icons/QrCodeScan.svelte";
    import DebugEvent from "./DebugEvent.svelte";

    let search = $state<string>();
    let basicInput = $state<string>();
    let basicInputSubtext = $state<string>();
    let basicInputError = $state<string>();
</script>

<DebugEvent>
    {#snippet children(onAction)}
        <Form onSubmit={() => onAction("Form submitted")}>
            <Container
                width={{ size: "500px" }}
                borderWidth={"thick"}
                borderRadius={"lg"}
                borderStyle={"dashed"}
                borderColour={"cyan"}
                padding={"lg"}
                gap={"lg"}
                direction="vertical">
                <Container direction={"vertical"} gap={"sm"}>
                    <Label labelFor={"search_component"}>Search control</Label>
                    <Search
                        id={"search_component"}
                        onSearch={(v) => onAction(`Search for ${v}`)}
                        placeholder={"Placeholder text..."}
                        bind:value={search} />
                </Container>

                <Container direction={"vertical"} gap={"sm"}>
                    <Label labelFor={"basic_input"}>Basic input</Label>
                    <Input id={"basic_input"} placeholder={"Basic input"} bind:value={basicInput} />
                </Container>

                <Container direction={"vertical"} gap={"sm"}>
                    <Label labelFor={"basic_input"}>Basic input</Label>
                    <Input id={"basic_input"} placeholder={"Basic input"} bind:value={basicInput}>
                        {#snippet iconButtons(color)}
                            <InputIconButton onClick={() => onAction("Button one clicked")}>
                                <Account {color} />
                            </InputIconButton>
                            <InputIconButton onClick={() => onAction("Button two clicked")}>
                                <QrCodeScan {color} />
                            </InputIconButton>
                        {/snippet}
                    </Input>
                </Container>

                <Container direction={"vertical"} gap={"sm"}>
                    <Label labelFor={"basic_input"}>Basic input</Label>
                    <Input id={"basic_input"} placeholder={"Basic input"} bind:value={basicInput}>
                        {#snippet textButtons()}
                            <InputTextButton onClick={() => onAction("Text button clicked")}>
                                max
                            </InputTextButton>
                        {/snippet}
                    </Input>
                </Container>

                <Container direction={"vertical"} gap={"sm"}>
                    <Label labelFor={"basic_input_subtext"}>Basic input with subtext</Label>
                    <Input
                        id={"basic_input_subtext"}
                        placeholder={"Basic input with subtext"}
                        bind:value={basicInputSubtext}>
                        {#snippet subtext()}
                            This is some subtext that we can put underneath the input
                        {/snippet}
                    </Input>
                </Container>

                <Container direction={"vertical"} gap={"sm"}>
                    <Label labelFor={"basic_input_error"}>Basic input with error</Label>
                    <Input
                        id={"basic_input_error"}
                        placeholder={"Basic input with error"}
                        bind:value={basicInputError}>
                        {#snippet error()}
                            This means that some sort of error occurred related to the field
                        {/snippet}
                    </Input>
                </Container>

                <Container direction={"vertical"} gap={"sm"}>
                    <Label labelFor={"basic_input_countdown"}>Basic input with countdown</Label>
                    <Input
                        countdown
                        id={"basic_input_countdown"}
                        placeholder={"Basic input with countdown"}
                        minlength={10}
                        maxlength={50} />
                </Container>

                <Container direction={"vertical"} gap={"sm"}>
                    <Label labelFor={"basic_input_icon"}>Basic input with icon</Label>
                    <Input id={"basic_input_icon"} placeholder={"Basic input with icon"}>
                        {#snippet icon(color)}
                            <Magnify {color} />
                        {/snippet}
                    </Input>
                </Container>
            </Container>
        </Form>

        {#if search}
            <pre>Search: {search}</pre>
        {/if}
        {#if basicInput}
            <pre>Basic Input: {basicInput}</pre>
        {/if}
        {#if basicInputSubtext}
            <pre>Basic input with subtext: {basicInputSubtext}</pre>
        {/if}
        {#if basicInputError}
            <pre>Basic input with error: {basicInputError}</pre>
        {/if}
    {/snippet}
</DebugEvent>
