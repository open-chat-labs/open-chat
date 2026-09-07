<script lang="ts">
    import { i18nKey } from "@src/i18n/i18n";
    import {
        Body,
        BodySmall,
        ColourVars,
        CommonButton,
        Container,
        Logo,
        Overview,
        Row,
        Sheet,
        Subtitle,
    } from "component-lib";
    import { publish, type OpenChat } from "@client";
    import { isAndroidTauriApp } from "@shared";
    import { toastStore } from "@src/stores/toast";
    import { clearCrashLog, formatCrashLog } from "@utils/errorPostmortem";
    import { navigate } from "@utils/navigation";
    import { getContext, onMount } from "svelte";
    import ChevronRight from "svelte-material-icons/ChevronRight.svelte";
    import { getShellVersion, openUrl } from "tauri-plugin-oc-api";
    import SlidingPageContent from "../SlidingPageContent.svelte";

    type OnClick = { kind: "route"; url: string } | { kind: "action"; action: () => void };

    const client = getContext<OpenChat>("client");

    // The web version currently running, which after an OTA update is the
    // downloaded bundle rather than the one the shell shipped with.
    //@ts-ignore
    let version = window.OC_WEBSITE_VERSION;

    // The version of the installed binary. Only differs from `version` once an
    // OTA update has been applied, and knowing which is which matters when
    // reading a crash report.
    let shellVersion = $state<string | undefined>(undefined);

    onMount(() => {
        // Android only, matching VersionChecker. iOS has no OTA path, so its
        // shell and web versions cannot diverge and the row would be noise.
        if (isAndroidTauriApp()) {
            getShellVersion()
                .then((v) => (shellVersion = v))
                .catch(() => (shellVersion = undefined));
        }
    });

    let crashLogTaps = 0;
    let crashLogTapTimer: number | undefined = undefined;
    let showCrashLog = $state(false);
    let crashLogText = $state("");

    function versionTapped() {
        window.clearTimeout(crashLogTapTimer);
        crashLogTapTimer = window.setTimeout(() => (crashLogTaps = 0), 2000);
        if (++crashLogTaps >= 5) {
            crashLogTaps = 0;
            crashLogText = formatCrashLog();
            showCrashLog = true;
        }
    }

    function copyCrashLog() {
        navigator.clipboard.writeText(crashLogText).then(() => {
            toastStore.showSuccessToast(i18nKey("copiedToClipboard"));
        });
    }

    function onClearCrashLog() {
        clearCrashLog();
        crashLogText = formatCrashLog();
    }

    function goTo(url: string, local: boolean = true) {
        if (client.isNativeApp()) {
            openUrl({ url: new URL(url, local ? client.canonicalOrigin() : undefined).toString() });
        } else {
            navigate(url);
        }
    }
</script>

{#snippet menuitem(label: string, onclick: OnClick)}
    <Container
        onClick={onclick.kind === "action" ? onclick.action : () => goTo(onclick.url)}
        crossAxisAlignment={"center"}
    >
        <Body fontWeight={"bold"}>{label}</Body>
        <ChevronRight color={ColourVars.primary} />
    </Container>
{/snippet}

<SlidingPageContent title={i18nKey("About")}>
    <Container
        padding={["sm", "xxl", "xxl", "xxl"]}
        height={"fill"}
        gap={"xs"}
        crossAxisAlignment={"center"}
        direction={"vertical"}
    >
        <Logo size={"huge"} />
        <Overview align={"center"} colour={"primary"}>OpenChat</Overview>
        <!-- svelte-ignore a11y_click_events_have_key_events -->
        <!-- svelte-ignore a11y_no_static_element_interactions -->
        <div onclick={versionTapped}>
            <BodySmall fontWeight={"bold"} align={"center"} colour={"textSecondary"}
                >Android / {version}</BodySmall
            >
            {#if shellVersion !== undefined}
                <BodySmall align={"center"} colour={"textSecondary"}
                    >Shell / {shellVersion}</BodySmall
                >
            {/if}
        </div>
        <div class="line"></div>
        <Container direction={"vertical"} gap={"xl"}>
            {@render menuitem("Architecture", {
                kind: "action",
                action: () => publish("architecture"),
            })}
            {@render menuitem("Blog", { kind: "route", url: "/blog" })}
            {@render menuitem("FAQ", { kind: "route", url: "/faq" })}
            {@render menuitem("Features", { kind: "route", url: "/features" })}
            {@render menuitem("Guidelines", { kind: "route", url: "/guidelines" })}
            {@render menuitem("Metrics", {
                kind: "route",
                url: "https://tokenterminal.com/explorer/projects/openchat",
            })}
            {@render menuitem("Privacy", { kind: "route", url: "/privacy" })}
            {@render menuitem("Roadmap", { kind: "route", url: "/roadmap" })}
            {@render menuitem("Terms", { kind: "route", url: "/terms" })}
            {@render menuitem("Whitepaper", { kind: "route", url: "/whitepaper" })}
        </Container>
    </Container>
</SlidingPageContent>

{#if showCrashLog}
    <Sheet onDismiss={() => (showCrashLog = false)}>
        <Container direction={"vertical"} gap={"lg"} padding={"lg"}>
            <Subtitle fontWeight={"bold"}>Crash log</Subtitle>
            <pre class="crash-log">{crashLogText}</pre>
            <Row gap={"md"} mainAxisAlignment={"end"} crossAxisAlignment={"center"}>
                <CommonButton size={"small_text"} onClick={onClearCrashLog}>Clear</CommonButton>
                <CommonButton mode={"active"} size={"medium"} onClick={copyCrashLog}
                    >Copy</CommonButton>
            </Row>
        </Container>
    </Sheet>
{/if}

<style lang="scss">
    .crash-log {
        max-height: 50vh;
        overflow: auto;
        white-space: pre-wrap;
        word-break: break-all;
        font-size: 0.7rem;
        line-height: 1.3;
        user-select: text;
        -webkit-user-select: text;
        color: var(--text-secondary);
    }

    .line {
        margin: var(--sp-xl) 0;
        height: 6px;
        width: 100%;
        border-radius: var(--rad-circle);
        background-color: var(--primary);
    }
</style>
