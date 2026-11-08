<!-- The attach panel, in the keyboard's place under the composer (native design notes §3.3): in the
     apps, the gallery strip (Camera, All photos) over the 3 × 2 actions (File, Poll, Prize, Send
     crypto, Swap, Meme fighter); on mobile web no strip, the photos and the camera joining the
     actions, centred in four columns. Only what the chat lets the reader send is offered. The
     strip's recent photos, picking several and the Recents grid need a native bridge to the
     phone's photos (GAPS.md, Native composer). -->
<script lang="ts">
    import type { ComposerBuilder } from "@src/logic/composer/composer";
    import { _ } from "svelte-i18n";

    type Pick = "media" | "camera" | "file";

    type Props = {
        /** The apps' gallery strip; on mobile web its pickers are actions. */
        gallery: boolean;
        /** Photos and videos may be sent. */
        media: boolean;
        /** Files may be sent. */
        file: boolean;
        /** The builders offered (logic/composer's composerBuilders). */
        builders: ComposerBuilder[];
        onPick: (kind: Pick) => void;
        onBuild: (builder: ComposerBuilder) => void;
    };

    let { gallery, media, file, builders, onPick, onBuild }: Props = $props();

    type Action = { id: string; label: string; icon: string; onClick: () => void };

    const BUILDERS: Record<ComposerBuilder, { label: string; icon: string }> = {
        poll: { label: "native.composer.attach.poll", icon: "poll" },
        prize: { label: "native.composer.attach.prize", icon: "trophy" },
        crypto: { label: "native.composer.attach.sendCrypto", icon: "wallet-send" },
        swap: { label: "native.composer.attach.swap", icon: "swap" },
        memeFighter: { label: "native.composer.attach.memeFighter", icon: "joystick" },
    };

    const actions = $derived.by((): Action[] => {
        const list: Action[] = [];
        if (media && !gallery) {
            list.push(
                {
                    id: "media",
                    label: $_("native.composer.attach.photos"),
                    icon: "image",
                    onClick: () => onPick("media"),
                },
                {
                    id: "camera",
                    label: $_("native.composer.attach.camera"),
                    icon: "camera",
                    onClick: () => onPick("camera"),
                },
            );
        }
        if (file) {
            list.push({
                id: "file",
                label: $_("native.composer.attach.file"),
                icon: "file",
                onClick: () => onPick("file"),
            });
        }
        for (const builder of builders) {
            list.push({
                id: builder,
                label: $_(BUILDERS[builder].label),
                icon: BUILDERS[builder].icon,
                onClick: () => onBuild(builder),
            });
        }
        return list;
    });
</script>

<div class="panel" class:web={!gallery} role="group" aria-label={$_("native.composer.attach.label")}>
    {#if gallery && media}
        <div class="strip" data-tab-swipe="off">
            <button type="button" class="tile" onclick={() => onPick("camera")}>
                <span class="tile-icon" style:mask="var(--icon-camera) center/contain no-repeat"
                ></span>
                <span class="tile-label">{$_("native.composer.attach.camera")}</span>
            </button>
            <button type="button" class="tile" onclick={() => onPick("media")}>
                <span class="tile-icon" style:mask="var(--icon-image) center/contain no-repeat"
                ></span>
                <span class="tile-label">{$_("native.composer.attach.allPhotos")}</span>
            </button>
        </div>
    {/if}
    <div class="actions">
        {#each actions as action (action.id)}
            <button type="button" class="action" onclick={action.onClick}>
                <span class="action-tile">
                    <span
                        class="action-icon"
                        style:mask="var(--icon-{action.icon}) center/contain no-repeat"
                    ></span>
                </span>
                <span class="action-label">{action.label}</span>
            </button>
        {/each}
    </div>
</div>

<style lang="scss">
    @use "@openchat/ui/src/lib/styles/mixins" as *;

    .panel {
        box-sizing: border-box;
        height: 100%;
        overflow-y: auto;
        display: flex;
        flex-direction: column;
        gap: var(--space-16);
        padding: var(--space-12) var(--space-16) max(var(--safe-bottom), var(--space-12));
        background: var(--surface-0);
        box-shadow: inset 0 1px 0 var(--line-1);
        animation: oc-veil-in 0.18s ease-out;

        @include reduced-motion {
            animation: none;
        }
    }

    // the gallery strip: square tiles in a row, scrolled sideways
    .strip {
        flex: none;
        display: flex;
        gap: var(--space-8);
        overflow-x: auto;
        scrollbar-width: none;
    }

    .tile {
        flex: none;
        width: 96px;
        height: 96px;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: var(--space-8);
        border: 0;
        border-radius: 14px;
        background: var(--overlay-1);
        color: var(--ink-2);
        cursor: pointer;
        -webkit-tap-highlight-color: transparent;

        &:active {
            background: var(--overlay-2);
        }
    }

    .tile-icon {
        width: 24px;
        height: 24px;
        background: var(--ink-2);
    }

    .tile-label {
        font: var(--weight-medium) text-size(12px) / 1.2 var(--font-sans);
    }

    // the actions: 3 columns in the apps, 4 centred on mobile web
    .actions {
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: var(--space-16) var(--space-8);

        .web & {
            grid-template-columns: repeat(4, minmax(0, 80px));
            justify-content: center;
            column-gap: var(--space-16);
        }
    }

    .action {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: var(--space-6);
        min-width: 0;
        padding: 0;
        border: 0;
        background: none;
        color: var(--ink-2);
        cursor: pointer;
        -webkit-tap-highlight-color: transparent;

        &:active .action-tile {
            background: var(--overlay-2);
        }
    }

    // 56px, with the FAB's 18px radius
    .action-tile {
        width: 56px;
        height: 56px;
        display: grid;
        place-items: center;
        border-radius: 18px;
        background: var(--overlay-1);
    }

    .action-icon {
        width: 22px;
        height: 22px;
        background: var(--accent-bright);
    }

    .action-label {
        max-width: 100%;
        font: var(--weight-medium) text-size(12px) / 1.2 var(--font-sans);
        text-align: center;
        overflow-wrap: anywhere;
        @include line-clamp(2);
    }
</style>
