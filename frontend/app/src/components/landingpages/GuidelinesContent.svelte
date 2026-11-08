<!-- The guidelines, from Learn's content (web/features/marketing/learn/legal/guidelines.ts): the one
     copy of the text, which the web's /guidelines shows too. A section per card, the linked one
     (?section=) open. -->
<script lang="ts">
    import { mobileWidth, type OpenChat } from "@client";
    import { inlineMarkdown } from "@openchat/ui/src/pages/inlineMarkdown";
    import { guidelines } from "@src/web/features/marketing/learn/legal/guidelines";
    import { getContext } from "svelte";
    import Copy from "svelte-material-icons/ContentCopy.svelte";
    import { copySectionUrl } from "../../utils/urls";
    import CollapsibleCard from "../CollapsibleCard.svelte";

    interface Props {
        linked?: number | undefined;
        modal?: boolean;
    }

    let { linked = undefined, modal = false }: Props = $props();

    const client = getContext<OpenChat>("client");

    function copyUrl(e: Event, section: string): void {
        e.stopPropagation();
        void copySectionUrl(client, section);
    }

    const external = (href: string) => /^https?:/i.test(href);

    let copySize = $derived($mobileWidth ? "14px" : "16px");
    let color = $derived(modal ? "var(--txt)" : "var(--landing-txt)");
</script>

{#snippet rich(text: string)}{#each inlineMarkdown(text) as part}{#if part.kind === "link"}<a
                href={part.href}
                target={external(part.href) ? "_blank" : undefined}
                rel={external(part.href) ? "noreferrer noopener" : undefined}>{part.text}</a
            >{:else if part.kind === "bold"}<strong>{part.text}</strong>{:else}{part.text}{/if}{/each}{/snippet}

{#each guidelines.sections as section, i}
    <CollapsibleCard transition={false} first={i === 0} open={linked === Number(section.id)}>
        {#snippet titleSlot()}
            <div class:modal class="header">
                <span class="subtitle">{section.id}</span>
                <div class="title">
                    {section.title}
                    <div class="copy" onclick={(e) => copyUrl(e, section.id)}>
                        <Copy size={copySize} {color} />
                    </div>
                </div>
            </div>
        {/snippet}
        <div class:modal class="body">
            {#each section.blocks ?? [] as block}
                {#if block.kind === "para"}
                    <p>{@render rich(block.text)}</p>
                {:else if block.kind === "bullets"}
                    <ul class="list">
                        {#each block.items as item}<li>{@render rich(item)}</li>{/each}
                    </ul>
                {/if}
            {/each}
        </div>
    </CollapsibleCard>
{/each}

<style lang="scss">
    .body {
        padding: 0 0 toRem(30) toRem(80);
        max-width: 75%;
        color: var(--landing-txt);

        @include mobile() {
            padding: 0 0 toRem(24) 0;
            max-width: 100%;
        }

        &.modal {
            color: var(--txt);
            padding: 0 0 toRem(20) toRem(60);
            @include mobile() {
                padding: 0 0 toRem(15) 0;
            }
        }
    }

    .body p,
    .body li {
        @include font(book, normal, fs-100, 28);
    }

    .body p {
        margin-bottom: toRem(24);
    }

    .header {
        display: flex;
        align-items: center;
        flex: auto;
        color: var(--landing-txt);
        @include font(medium, normal, fs-160, 38);
        @include mobile() {
            @include font(medium, normal, fs-110, 24);
        }

        &.modal {
            color: var(--txt);
            @include font(medium, normal, fs-120, 38);
            @include mobile() {
                @include font(medium, normal, fs-100, 24);
            }
        }
    }

    .subtitle {
        flex: 0 0 toRem(80);

        @include mobile() {
            flex: 0 0 toRem(30);
        }
    }

    .modal .subtitle {
        flex: 0 0 toRem(60);

        @include mobile() {
            flex: 0 0 toRem(30);
        }
    }

    .title {
        flex: auto;
        display: flex;
        align-items: center;
        gap: $sp3;

        .copy {
            cursor: pointer;

            opacity: 0;
            transition: opacity 250ms ease-in-out;
        }

        &:hover .copy {
            opacity: 1;
        }
    }

    .list {
        @include bullet_list();
    }
</style>
