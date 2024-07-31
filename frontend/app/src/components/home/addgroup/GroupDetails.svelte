<script lang="ts">
    import { _ } from "svelte-i18n";
    import type { CandidateGroupChat } from "openchat-client";
    import EditableAvatar from "../../EditableAvatar.svelte";
    import Input from "../../Input.svelte";
    import TextArea from "../../TextArea.svelte";
    import Legend from "../../Legend.svelte";
    import { i18nKey } from "../../../i18n/i18n";

    const MIN_LENGTH = 3;
    const MAX_LENGTH = 40;
    const MAX_DESC_LENGTH = 1024;

    export let busy: boolean;
    export let candidateGroup: CandidateGroupChat;
    export let valid: boolean;

    $: {
        valid = candidateGroup.name.length > MIN_LENGTH && candidateGroup.name.length <= MAX_LENGTH;
    }

    function groupAvatarSelected(ev: CustomEvent<{ url: string; data: Uint8Array }>) {
        candidateGroup.avatar = {
            blobUrl: ev.detail.url,
            blobData: ev.detail.data,
        };
    }
</script>

<section>
    <Legend label={i18nKey("group.image", undefined, candidateGroup.level)} />
    <div class="photo">
        <EditableAvatar
            overlayIcon
            image={candidateGroup.avatar?.blobUrl}
            on:imageSelected={groupAvatarSelected} />
    </div>
</section>

<section>
    <Legend label={i18nKey("group.name", undefined, candidateGroup.level)} required />
    <Input
        autofocus
        disabled={busy}
        bind:value={candidateGroup.name}
        minlength={MIN_LENGTH}
        maxlength={MAX_LENGTH}
        countdown
        placeholder={i18nKey("newGroupName", undefined, candidateGroup.level, true)} />
</section>

<section>
    <Legend label={i18nKey("group.description", undefined, candidateGroup.level)} />
    <TextArea
        rows={4}
        disabled={busy}
        bind:value={candidateGroup.description}
        maxlength={MAX_DESC_LENGTH}
        placeholder={i18nKey("newGroupDesc", undefined, candidateGroup.level, true)} />
</section>

<style lang="scss">
    .photo {
        text-align: center;
        padding: $sp4 0;
        margin-bottom: $sp3;
    }

    section {
        margin-bottom: $sp5;
    }
</style>
