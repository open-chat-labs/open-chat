<!-- A person on the Invite people screen (native plan 10; picker rows, notes §1 Spacing): their
     avatar (photo, else swatch), name and a line under it, and at the end what the row is: a
     checkbox to pick them (the whole row picks), a Cancel pill (Pending: cancels their invite; a
     34px pill in a 44px tap area), or a mark for someone who can't be picked (a member, someone
     already invited), whose row is dimmed. -->
<script lang="ts">
    import Avatar from "@openchat/ui/src/lib/components/Avatar.svelte";
    import type { SenderColor } from "@src/logic/conversation/messageRow";

    type End =
        | { kind: "check"; on: boolean; onToggle: () => void }
        | { kind: "cancel"; label: string; onCancel: () => void }
        | { kind: "mark"; label: string };

    type Props = {
        name: string;
        /** Under the name: their @username, or what they are ("Invited · not accepted yet"). */
        sub: string;
        photoUrl: string | undefined;
        color: SenderColor;
        end: End;
    };

    let { name, sub, photoUrl, color, end }: Props = $props();
</script>

{#snippet person()}
    {#if photoUrl !== undefined}
        <img class="photo" src={photoUrl} alt="" />
    {:else}
        <Avatar size={40} {color} />
    {/if}
    <span class="text">
        <span class="name">{name}</span>
        <span class="sub">{sub}</span>
    </span>
{/snippet}

{#if end.kind === "check"}
    <button
        type="button"
        class="row"
        class:on={end.on}
        role="checkbox"
        aria-checked={end.on}
        onclick={end.onToggle}>
        {@render person()}
        <span class="check" aria-hidden="true"></span>
    </button>
{:else if end.kind === "cancel"}
    <div class="row">
        {@render person()}
        <button type="button" class="cancel" onclick={end.onCancel}>
            <span class="pill">{end.label}</span>
        </button>
    </div>
{:else}
    <div class="row dim">
        {@render person()}
        <span class="mark">{end.label}</span>
    </div>
{/if}

<style lang="scss">
    @use "@openchat/ui/src/lib/styles/mixins" as *;

    .row {
        flex: none;
        box-sizing: border-box;
        width: 100%;
        display: flex;
        align-items: center;
        gap: var(--space-12);
        min-height: 60px;
        padding: var(--space-8) var(--space-10);
        border: 0;
        border-radius: 14px;
        background: none;
        color: var(--ink);
        text-align: start;
        -webkit-tap-highlight-color: transparent;

        &:is(button) {
            cursor: pointer;

            &:active {
                background: var(--overlay-1);
            }

            &:focus-visible {
                @include focus-ring;
            }
        }

        // a member, or someone already invited: there, but not to pick
        &.dim {
            opacity: 0.45;
        }
    }

    .photo {
        flex: none;
        width: 40px;
        height: 40px;
        border-radius: var(--radius-circle);
        object-fit: cover;
    }

    .text {
        flex: 1;
        min-width: 0;
        display: flex;
        flex-direction: column;
        gap: var(--space-4);
    }

    .name {
        font: var(--weight-semibold) text-size(15px) / 1.2 var(--font-sans);
        @include truncate;
    }

    .sub {
        font: var(--weight-regular) text-size(13.5px) / 1.35 var(--font-sans);
        color: var(--ink-3);
        @include truncate;
    }

    // a ring, filled with a tick once picked (the forward sheet's)
    .check {
        flex: none;
        width: 24px;
        height: 24px;
        margin-inline-end: var(--space-4);
        box-sizing: border-box;
        border-radius: var(--radius-circle);
        border: 2px solid var(--overlay-3);
        position: relative;

        .on & {
            border: 0;
            background: var(--accent);

            &::after {
                content: "";
                position: absolute;
                inset: 0;
                margin: auto;
                width: 14px;
                height: 14px;
                mask: var(--icon-check) center/contain no-repeat;
                background: var(--on-accent);
            }
        }
    }

    // the pill is 34px; the tap area around it the touch target's 44px
    .cancel {
        flex: none;
        height: 44px;
        @include flex-center;
        padding: 0;
        border: 0;
        background: none;
        cursor: pointer;
        -webkit-tap-highlight-color: transparent;

        &:focus-visible {
            @include focus-ring;
        }

        &:active .pill {
            background: var(--overlay-3);
        }
    }

    .pill {
        height: 34px;
        box-sizing: border-box;
        display: flex;
        align-items: center;
        padding: 0 var(--space-14);
        border-radius: var(--radius-pill);
        background: var(--overlay-2);
        color: var(--ink);
        font: var(--weight-semibold) text-size(13.5px) / 1 var(--font-sans);
    }

    .mark {
        flex: none;
        font: var(--weight-semibold) text-size(12.5px) / 1 var(--font-sans);
        color: var(--ink-3);
    }
</style>
