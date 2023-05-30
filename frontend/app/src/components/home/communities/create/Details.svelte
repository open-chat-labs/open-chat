<script lang="ts">
    import { _ } from "svelte-i18n";
    import EditableAvatar from "../../../EditableAvatar.svelte";
    import Input from "../../../Input.svelte";
    import TextArea from "../../../TextArea.svelte";
    import Legend from "../../../Legend.svelte";
    import type { Community } from "openchat-client";

    const MIN_LENGTH = 3;
    const MAX_LENGTH = 25;
    const MAX_DESC_LENGTH = 1024;

    export let busy: boolean;
    export let community: Community;

    function communityAvatarSelected(ev: CustomEvent<{ url: string; data: Uint8Array }>) {
        community.avatar = {
            blobUrl: ev.detail.url,
            blobData: ev.detail.data,
        };
    }

    function communityBannerSelected(ev: CustomEvent<{ url: string; data: Uint8Array }>) {
        community.banner = {
            blobUrl: ev.detail.url,
            blobData: ev.detail.data,
        };
    }
</script>

<section class="images-section">
    <Legend label={$_("communities.imageLabel")} />
    <div class="images">
        <div class="banner">
            <EditableAvatar
                mode={"banner"}
                overlayIcon
                image={community.banner?.blobUrl}
                on:imageSelected={communityBannerSelected} />
        </div>
        <div class="avatar">
            <EditableAvatar
                overlayIcon
                size={"medium"}
                image={community.avatar?.blobUrl}
                on:imageSelected={communityAvatarSelected} />
        </div>
    </div>
</section>
<section>
    <Legend required label={$_("communities.name")} />
    <Input
        autofocus
        disabled={busy}
        bind:value={community.name}
        minlength={MIN_LENGTH}
        maxlength={MAX_LENGTH}
        countdown
        placeholder={$_("communities.namePlaceholder")} />
</section>
<section>
    <Legend required label={$_("communities.description")} rules={$_("supportsMarkdown")} />
    <TextArea
        rows={4}
        disabled={busy}
        bind:value={community.description}
        maxlength={MAX_DESC_LENGTH}
        placeholder={$_("communities.descriptionPlaceholder")} />
</section>

<style type="text/scss">
    .avatar {
        position: absolute;
        bottom: toRem(-32);
        left: toRem(24);
        border-radius: 50%;
        border: 2px solid var(--txt-light);
    }

    section {
        margin-bottom: $sp5;

        &.images-section {
            margin-bottom: $sp7;
        }
    }

    .images {
        position: relative;
    }
</style>
