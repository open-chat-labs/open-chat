<script lang="ts">
    import { querystringStore, type OpenChat } from "@client";
    import { getContext, onMount } from "svelte";
    import { currentThemeMode } from "../../theme/themes";
    import { openChatFriendlyUrl } from "../../utils/urls";

    // The interactive canister map (architecture/canister_map) is a page of its own which the
    // website build writes to /canisters, so the architecture pages show it in a frame. The
    // frame follows the site's theme, and (where `syncUrl` is set) the canister selected in the
    // map is mirrored in this page's url as ?section=<canister>, the landing pages' convention
    // for linking to a section, so that it can be shared.
    interface Props {
        syncUrl?: boolean;
    }

    let { syncUrl = false }: Props = $props();

    const client = getContext<OpenChat>("client");

    // The native shells don't carry the page, so they frame the one on the website
    const base = client.isNativeApp() ? `${openChatFriendlyUrl}/canisters` : "/canisters";
    // Captured once: the url is a load-time input, the theme and section are kept in sync by
    // message after
    const initialSection = syncUrl ? $querystringStore.get("section") : null;
    const src = `${base}?theme=${$currentThemeMode}${initialSection ? `#${initialSection}` : ""}`;

    let frame: HTMLIFrameElement | undefined = $state(undefined);
    let shownSection: string | null = initialSection;

    onMount(() => {
        const origin = new URL(base, window.location.href).origin;

        function onMessage(ev: MessageEvent) {
            if (ev.origin !== origin || ev.source !== frame?.contentWindow) return;
            if (
                syncUrl &&
                ev.data?.type === "oc-canister-map" &&
                typeof ev.data.hash === "string"
            ) {
                shownSection = ev.data.hash.replace("#", "") || null;
                const query = shownSection ? `?section=${shownSection}` : "";
                history.replaceState(null, "", window.location.pathname + query);
            }
        }
        window.addEventListener("message", onMessage);

        // A section set after load (a link to /architecture?section=<canister> followed from
        // this page) is passed on, since the frame's url only carried the one it loaded with
        const unsubSection = syncUrl
            ? querystringStore.subscribe((query) => {
                  const section = query.get("section");
                  if (section === shownSection) return;
                  shownSection = section;
                  frame?.contentWindow?.postMessage(
                      { type: "oc-canister-map-select", hash: section ? `#${section}` : "" },
                      origin,
                  );
              })
            : undefined;

        const unsubTheme = currentThemeMode.subscribe((theme) => {
            frame?.contentWindow?.postMessage({ type: "oc-canister-map-theme", theme }, origin);
        });

        return () => {
            window.removeEventListener("message", onMessage);
            unsubSection?.();
            unsubTheme();
        };
    });
</script>

<iframe bind:this={frame} {src} title="OpenChat canister map"></iframe>

<style lang="scss">
    iframe {
        display: block;
        width: 100%;
        height: 100%;
        border: 0;
        background: var(--landing-bg);
    }
</style>
