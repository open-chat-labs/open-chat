<!-- A legal doc (the terms, the privacy notice) as the old pages showed it, from Learn's content
     (web/features/marketing/learn/legal), the one copy of the text, which the web's pages show too:
     its preamble, then each section's heading (a ?section= target with a copy link) and its numbered
     clauses. A clause's number is the doc's own; a lettered one (A1, B2) heads its section's list. -->
<script lang="ts">
    import type { OpenChat } from "@client";
    import { inlineMarkdown } from "@openchat/ui/src/pages/inlineMarkdown";
    import type { LearnBlock, LearnClause, LearnDoc } from "@openchat/ui/src/pages/learnContent";
    import { getContext } from "svelte";
    import { copySectionUrl } from "../../utils/urls";
    import HashLinkTarget from "./HashLinkTarget.svelte";

    interface Props {
        doc: LearnDoc;
        /** The headings show their section's number ("1. Who is responsible …"), as the privacy notice's did. */
        numberedHeadings?: boolean;
    }

    let { doc, numberedHeadings = false }: Props = $props();

    const client = getContext<OpenChat>("client");

    function onCopyUrl(e: Event, section: string): void {
        e.stopPropagation();
        void copySectionUrl(client, section);
    }

    const lettered = (items: LearnClause[]) => items.every((c) => /^[A-Z]\d+$/.test(c.number));
    const external = (href: string) => /^https?:/i.test(href);
</script>

{#snippet rich(text: string)}{#each inlineMarkdown(text) as part}{#if part.kind === "link"}<a
                href={part.href}
                target={external(part.href) ? "_blank" : undefined}
                rel={external(part.href) ? "noreferrer noopener" : undefined}>{part.text}</a
            >{:else if part.kind === "bold"}<strong>{part.text}</strong>{:else}{part.text}{/if}{/each}{/snippet}

{#snippet blocks(list: LearnBlock[])}
    {#each list as b}
        {#if b.kind === "para"}
            <p>{@render rich(b.text)}</p>
        {:else if b.kind === "bullets"}
            <ul class="custom_list">
                {#each b.items as item}<li>{@render rich(item)}</li>{/each}
            </ul>
        {:else if b.kind === "definitions"}
            <div class="interpretation">
                {#each b.items as d}
                    <div>{@render rich(d.term)}</div>
                    <div>{@render rich(d.meaning)}</div>
                {/each}
            </div>
        {:else}
            <ul class="custom_list" class:bold={lettered(b.items)}>
                {#each b.items as c}
                    <li>
                        <span class="num">{c.number}</span>
                        {#if c.title}<h3>{c.title}</h3>{/if}
                        {@render blocks(c.body)}
                    </li>
                {/each}
            </ul>
        {/if}
    {/each}
{/snippet}

{#if doc.intro?.length}
    <div class="preamble">
        {#each doc.intro as p}<p>{@render rich(p)}</p>{/each}
    </div>
{/if}

<div class="section">
    {#each doc.sections as s}
        <HashLinkTarget {onCopyUrl} id={s.id}>
            <h2>{numberedHeadings ? `${s.id}. ` : ""}{s.title}</h2>
        </HashLinkTarget>
        {@render blocks(s.blocks ?? [])}
    {/each}
</div>

<style lang="scss">
    .preamble p {
        margin-bottom: toRem(24);
    }

    .section {
        h2,
        h3 {
            margin-bottom: $sp4;
            display: inline-block;
        }
        p {
            margin-bottom: $sp4;
        }
        li > p:last-child {
            margin-bottom: 0;
        }
        h2 {
            @include font(bold, normal, fs-120);
        }

        h3 {
            @include font(bold, normal, fs-110);
        }

        .custom_list.bold > li > h3 {
            padding-left: 60px;
        }

        .custom_list {
            list-style-type: none;
            @include font(book, normal, fs-100);
            margin-bottom: $sp5;
        }

        .custom_list > li {
            padding-left: 60px;
            position: relative;
            margin-bottom: $sp3;
        }

        .custom_list.bold > li {
            padding-left: 0;
        }

        .num {
            font-weight: normal;
            position: absolute;
            left: 0;
        }

        .custom_list.bold > li > .num {
            font-weight: bold;
        }
    }

    .interpretation {
        display: grid;
        grid-template-columns: 1fr 2fr;
        gap: $sp4;
        margin-bottom: $sp4;

        @include mobile() {
            grid-template-columns: 1fr;
            gap: $sp3;
        }

        :nth-child(2n-1) {
            font-weight: bold;
        }
    }
</style>
