<script lang="ts">
    import {
        emptyBotInstance,
        type CandidateExternalBot,
        type SlashCommandPermissions,
        type SlashCommandSchema,
    } from "openchat-client";
    import { i18nKey } from "../../i18n/i18n";
    import Input from "../Input.svelte";
    import Legend from "../Legend.svelte";
    import EditableAvatar from "../EditableAvatar.svelte";
    import Button from "../Button.svelte";
    import Translatable from "../Translatable.svelte";
    import CommandSummary from "./CommandSummary.svelte";
    //    import { SvelteSet as Set } from "svelte/reactivity";

    interface Props {
        valid: boolean;
    }

    let { valid = $bindable() }: Props = $props();

    let candidate = $state<CandidateExternalBot>(emptyBotInstance());

    $effect(() => {
        const isValid = validateCandidate();
        if (isValid !== valid) {
            valid = isValid;
        }
    });

    function validateCandidate() {
        console.log("Candidate: ", JSON.stringify(candidate, null, 4));
        return true;
    }

    function botAvatarSelected(ev: CustomEvent<{ url: string; data: Uint8Array }>) {
        candidate.icon = {
            blobUrl: ev.detail.url,
            blobData: ev.detail.data,
        };
    }

    function onSubmit(e: Event) {
        e.preventDefault();
    }

    function addCommand() {
        candidate.commands.push(emptySlashCommand());
    }

    function onDelete(cmd: SlashCommandSchema) {
        candidate.commands = candidate.commands.filter((c) => c !== cmd);
    }

    function emptySlashCommand(): SlashCommandSchema {
        return {
            name: "",
            description: "",
            params: [],
            permissions: emptyPermissions(),
        };
    }

    function emptyPermissions(): SlashCommandPermissions {
        return {
            chatPermissions: [],
            communityPermissions: [],
            messagePermissions: [],
            threadPermissions: [],
        };
    }
</script>

<form onsubmit={onSubmit} class="bot">
    <Legend label={i18nKey("Bot avatar image")} />
    <div class="photo">
        <EditableAvatar
            overlayIcon
            size={"medium"}
            image={candidate.icon?.blobUrl}
            on:imageSelected={botAvatarSelected} />
    </div>

    <Legend
        required
        label={i18nKey("Bot name")}
        rules={i18nKey("Must be unique and contain alphanumeric characters and underscores only")}
    ></Legend>
    <Input
        minlength={3}
        maxlength={25}
        placeholder={i18nKey("Enter bot name")}
        bind:value={candidate.name} />

    <Legend label={i18nKey("Bot desription")} rules={i18nKey("optional")}></Legend>
    <Input
        minlength={3}
        maxlength={200}
        placeholder={i18nKey("Enter bot descritpion")}
        bind:value={candidate.description} />

    <Legend
        label={i18nKey("Bot endpoint")}
        required
        rules={i18nKey("The url origin of your bot server")}></Legend>
    <Input
        minlength={3}
        maxlength={200}
        placeholder={i18nKey("https://my_openchat_bot")}
        bind:value={candidate.endpoint} />

    <div class="commands">
        <Legend
            label={i18nKey("Bot commands")}
            required
            rules={i18nKey("Create one or more commands to add behaviour to your bot")}></Legend>
        <div class="commands">
            {#each candidate.commands as _, i}
                <CommandSummary {onDelete} bind:command={candidate.commands[i]}></CommandSummary>
            {/each}
        </div>

        <Button on:click={addCommand}>
            <Translatable resourceKey={i18nKey("Add command")} />
        </Button>
    </div>

    <pre class="debug">
        {JSON.stringify(candidate, null, 4)}
    </pre>
</form>

<style lang="scss">
    .debug {
        @include font(book, normal, fs-80);
    }
    .photo {
        max-width: toRem(100);
        margin-bottom: $sp3;
    }
    .commands {
        margin-bottom: $sp3;
    }
</style>
