<!-- The details' Members row, a group's, channel's or community's (the user's design of 2026-11-25
     for a community's details, a group's to match): the users icon, "Members" over "1,248
     members" (smaller, regular, secondary), a few faces (26px, at most 4) and a chevron; a tap
     opens the Members screen. -->
<script lang="ts">
    import AvatarStack from "@openchat/ui/src/lib/components/AvatarStack.svelte";
    import { _ } from "svelte-i18n";

    type Props = {
        count: number;
        faces: { src?: string; grad?: string }[];
        onOpen: () => void;
    };

    let { count, faces, onOpen }: Props = $props();
</script>

<button type="button" class="settings-row members-row" onclick={onOpen}>
    <span class="icon" aria-hidden="true"></span>
    <span class="text">
        <span class="label">{$_("members")}</span>
        <span class="count">{$_("native.details.membersCount", { values: { count } })}</span>
    </span>
    <AvatarStack people={faces} max={4} size={26} ring="var(--surface-0)" />
    <span class="chevron"></span>
</button>

<style lang="scss">
    @use "@openchat/ui/src/lib/styles/mixins" as *;

    .members-row {
        width: 100%;
        display: flex;
        align-items: center;
        gap: 14px;
        min-height: 60px;
        padding: 10px 16px;
        box-sizing: border-box;
        border: 0;
        background: none;
        color: var(--ink);
        text-align: start;
        cursor: pointer;
        -webkit-tap-highlight-color: transparent;

        &:active {
            background: var(--overlay-1);
        }

        &:focus-visible {
            @include focus-ring;
        }
    }

    .icon {
        @include icon(users, 19px, var(--ink-3));
        flex: none;
    }

    .text {
        flex: 1;
        min-width: 0;
        display: flex;
        flex-direction: column;
        gap: 3px;
    }

    .label {
        font: var(--weight-medium) text-size(15px) / 1.2 var(--font-sans);
    }

    .count {
        font: var(--weight-regular) text-size(13px) / 1.2 var(--font-sans);
        color: var(--ink-3);
    }

    .chevron {
        @include icon(chevron-right, 14px, var(--ink-4));
        flex: none;

        &:dir(rtl) {
            transform: scaleX(-1);
        }
    }
</style>
