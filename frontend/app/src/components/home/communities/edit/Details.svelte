<script lang="ts">
    import { _ } from "svelte-i18n";
    import EditableAvatar from "../../../EditableAvatar.svelte";
    import Input from "../../../Input.svelte";
    import TextArea from "../../../TextArea.svelte";
    import Select from "../../../Select.svelte";
    import Legend from "../../../Legend.svelte";
    import { i18nKey, supportedLanguages } from "../../../../i18n/i18n";
    import type { CommunitySummary } from "openchat-client";

    const MIN_LENGTH = 3;
    const MAX_LENGTH = 25;
    const MAX_DESC_LENGTH = 1024;

    interface Props {
        busy: boolean;
        candidate: CommunitySummary;
        valid: boolean;
    }

    let { busy, candidate = $bindable(), valid = $bindable() }: Props = $props();

    $effect(() => {
        const isValid =
            candidate.name.length >= MIN_LENGTH &&
            candidate.name.length <= MAX_LENGTH &&
            candidate.description.length <= MAX_DESC_LENGTH &&
            candidate.description.length > 0;
        if (isValid !== valid) {
            valid = isValid;
        }
    });

    function communityAvatarSelected(ev: CustomEvent<{ url: string; data: Uint8Array }>) {
        candidate.avatar = {
            blobUrl: ev.detail.url,
            blobData: ev.detail.data,
        };
    }

    function communityBannerSelected(ev: CustomEvent<{ url: string; data: Uint8Array }>) {
        candidate.banner = {
            blobUrl: ev.detail.url,
            blobData: ev.detail.data,
        };
    }
</script>

<section class="images-section">
    <Legend label={i18nKey("communities.imageLabel")} />
    <div class="images">
        <div class="banner">
            <EditableAvatar
                mode={"banner"}
                overlayIcon
                image={candidate.banner?.blobUrl}
                on:imageSelected={communityBannerSelected} />
        </div>
        <div class="avatar">
            <EditableAvatar
                overlayIcon
                size={"medium"}
                image={candidate.avatar?.blobUrl}
                on:imageSelected={communityAvatarSelected} />
        </div>
    </div>
</section>
<section>
    <Legend required label={i18nKey("communities.name")} />
    <Input
        autofocus
        disabled={busy}
        bind:value={candidate.name}
        minlength={MIN_LENGTH}
        maxlength={MAX_LENGTH}
        countdown
        placeholder={i18nKey("communities.namePlaceholder")} />
</section>
<section>
    <Legend label={i18nKey("communities.primaryLanguage")} />
    <Select bind:value={candidate.primaryLanguage}>
        {#each supportedLanguages as lang}
            <option value={lang.code}>{lang.name}</option>
        {/each}
    </Select>
</section>
<section>
    <Legend
        required
        label={i18nKey("communities.description")}
        rules={i18nKey("supportsMarkdown")} />
    <TextArea
        rows={4}
        disabled={busy}
        bind:value={candidate.description}
        maxlength={MAX_DESC_LENGTH}
        placeholder={i18nKey("communities.descriptionPlaceholder")} />
</section>

<style lang="scss">
    .avatar {
        position: absolute;
        bottom: toRem(-32);
        left: toRem(24);
        border-radius: var(--avatar-rd);
        border: 2px solid var(--txt-light);
    }

    section {
        margin-bottom: $sp4;

        &.images-section {
            margin-bottom: $sp7;
        }
    }

    .images {
        position: relative;
    }
</style>
