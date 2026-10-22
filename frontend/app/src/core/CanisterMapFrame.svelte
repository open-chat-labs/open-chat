<script lang="ts">
    import { querystringStore, type OpenChat } from "@client";
    import { Body, Column, CommonButton } from "component-lib";
    import { getContext, onMount } from "svelte";
    import { currentThemeMode } from "@src/theme/themes";
    import { openChatFriendlyUrl, openExternalUrl } from "@src/utils/urls";

    // The interactive canister map (architecture/canister_map) is a page of its own which the
    // website build writes under a name carrying the website version (rollup.config.mjs, which
    // tells the app the path), so the architecture pages show it in a frame. The frame follows
    // the site's theme, and (where `syncUrl` is set) the canister selected in the map is
    // mirrored in this page's url as ?section=<canister>, the landing pages' convention for
    // linking to a section, so that it can be shared.
    interface Props {
        syncUrl?: boolean;
    }

    let { syncUrl = false }: Props = $props();

    const client = getContext<OpenChat>("client");
    const mapPath: string = import.meta.env.OC_CANISTER_MAP_PATH;

    // The native shells don't carry the page, and iOS cancels an iframe's navigation to another
    // origin, so they offer the website's Architecture page instead of framing it
    const native = client.isNativeApp();
    const websitePage = `${openChatFriendlyUrl}/architecture`;

    function sectionInUrl(): string | null {
        return new URLSearchParams(window.location.search).get("section");
    }

    // Captured once: the url is a load-time input, the theme and section are kept in sync by
    // message after
    const initialSection = syncUrl ? sectionInUrl() : null;
    const src = `${mapPath}?theme=${$currentThemeMode}${initialSection ? `#${initialSection}` : ""}`;

    let frame: HTMLIFrameElement | undefined = $state(undefined);
    let shownSection: string | null = initialSection;

    function openMap() {
        openExternalUrl(client, websitePage).catch((error) => {
            console.error("Failed to open the canister map", error);
        });
    }

    onMount(() => {
        if (native) return;

        function onMessage(ev: MessageEvent) {
            if (ev.origin !== window.location.origin || ev.source !== frame?.contentWindow) return;
            if (
                syncUrl &&
                ev.data?.type === "oc-canister-map" &&
                typeof ev.data.hash === "string"
            ) {
                shownSection = ev.data.hash.replace("#", "") || null;
                // Rewritten in place, keeping any other parameters (?ref= and the like): a
                // navigation through the router would log a page view per canister
                const params = new URLSearchParams(window.location.search);
                if (shownSection) params.set("section", shownSection);
                else params.delete("section");
                const query = params.toString();
                history.replaceState(
                    null,
                    "",
                    window.location.pathname + (query ? `?${query}` : ""),
                );
            }
        }
        window.addEventListener("message", onMessage);

        // A section set by a later navigation (a link to /architecture?section=<canister>
        // followed from this page, or back/forward) is passed on, since the frame's url only
        // carried the one it loaded with. The store reports the router's context, which the
        // rewrite above doesn't update, so a navigation whose context equals the last one the
        // router saw (the header's own Architecture link while a canister is open) is not
        // reported, and leaves that canister open; nothing else depends on it.
        const unsubQuery = syncUrl
            ? querystringStore.subscribe((query) => {
                  const section = query.get("section");
                  if (section === shownSection) return;
                  shownSection = section;
                  frame?.contentWindow?.postMessage(
                      { type: "oc-canister-map-select", hash: section ? `#${section}` : "" },
                      window.location.origin,
                  );
              })
            : undefined;

        const unsubTheme = currentThemeMode.subscribe((theme) => {
            frame?.contentWindow?.postMessage(
                { type: "oc-canister-map-theme", theme },
                window.location.origin,
            );
        });

        return () => {
            window.removeEventListener("message", onMessage);
            unsubQuery?.();
            unsubTheme();
        };
    });
</script>

{#if native}
    <Column padding={"lg"} gap={"lg"}>
        <Body colour={"textSecondary"}>
            The canister map is an interactive page on the OpenChat website: every canister OpenChat
            runs, with its endpoints, state and the calls between them.
        </Body>
        <CommonButton mode={"active"} size={"medium"} onClick={openMap}>
            Open the canister map
        </CommonButton>
    </Column>
{:else}
    <iframe bind:this={frame} {src} title="OpenChat canister map"></iframe>
{/if}

<style lang="scss">
    iframe {
        display: block;
        width: 100%;
        height: 100%;
        border: 0;
        background: var(--landing-bg);
    }
</style>
