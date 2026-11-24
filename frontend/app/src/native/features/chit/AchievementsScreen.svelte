<!-- The achievements (the ways to earn CHIT), pushed from CHIT's View all (native plan 14): every
     achievement the web's AchievementsDialog lists (logic/chit/achievements, achievementList in
     @client, the partners' loaded as it opens), by the dialog's groups (ACHIEVEMENT_GROUPS), each
     with what it pays and a tick once done. The plan names the screen only: its layout is the
     settings kit's cards (GAPS.md, "Native CHIT"). -->
<script lang="ts">
    import {
        achievementList,
        achievements,
        achievementsStore,
        type ExternalAchievement,
        type OpenChat,
    } from "@client";
    import { ACHIEVEMENT_GROUPS } from "@openchat/ui/src/features/components/AchievementsDialog.svelte";
    import NativePageHeader from "@openchat/ui/src/native/NativePageHeader.svelte";
    import SettingsGroup from "@openchat/ui/src/native/SettingsGroup.svelte";
    import { achievementItems } from "@src/logic/chit/achievements";
    import { loadExternalAchievements, type Loaded } from "@src/logic/chit/externalAchievements";
    import { getContext, onMount } from "svelte";
    import { _, locale } from "svelte-i18n";
    import type { NativeScreen } from "../../router/locations";
    import type { ScreenProps } from "../app/screens";

    let { context }: ScreenProps<Extract<NativeScreen, { kind: "achievements" }>> = $props();

    const client = getContext<OpenChat>("client");

    let external = $state<Loaded<ExternalAchievement[]>>();
    onMount(async () => {
        external = await loadExternalAchievements(client);
    });

    const items = $derived(
        achievementItems(
            achievementList(
                achievements,
                $achievementsStore,
                external?.value ?? [],
                external?.at ?? Date.now(),
            ),
            (id) => $_(`learnToEarn.${id}`),
        ),
    );
    const groups = $derived(
        ACHIEVEMENT_GROUPS.map((g) => ({ ...g, items: items.filter((a) => a.group === g.key) })).filter(
            (g) => g.items.length > 0,
        ),
    );
    const done = $derived(items.filter((a) => a.done).length);
</script>

<div class="achievements">
    <NativePageHeader
        title={$_("native.chit.achievements")}
        sub={$_("native.chit.achievementsDone", { values: { done, total: items.length } })}
        onBack={context.back} />

    <div class="body">
        {#each groups as group (group.key)}
            <SettingsGroup label={$_(group.label)}>
                {#each group.items as a (a.id)}
                    <div class="settings-row item" class:done={a.done}>
                        <span class="text">{a.label}</span>
                        <span class="reward">
                            {$_("native.you.chit.pays", {
                                values: { amount: a.reward.toLocaleString($locale ?? "en") },
                            })}
                        </span>
                        <span class="tick" aria-label={a.done ? $_("native.chit.achievementDone") : undefined}></span>
                    </div>
                {/each}
            </SettingsGroup>
        {/each}
    </div>
</div>

<style lang="scss">
    @use "@openchat/ui/src/lib/styles/mixins" as *;

    .achievements {
        display: flex;
        flex-direction: column;
        height: 100%;
        min-height: 0;
    }

    .body {
        flex: 1;
        min-height: 0;
        overflow-y: auto;
        scrollbar-width: none;
        display: flex;
        flex-direction: column;
        gap: 22px;
        padding: 8px var(--space-16) var(--scroll-end);
    }

    .item {
        display: flex;
        align-items: center;
        gap: 12px;
        min-height: 52px;
        padding: 8px 16px;
        box-sizing: border-box;
    }

    .text {
        flex: 1;
        min-width: 0;
        font: var(--weight-medium) text-size(14.5px) / 1.3 var(--font-sans);

        .done & {
            color: var(--ink-3);
        }
    }

    .reward {
        flex: none;
        font: var(--weight-semibold) text-size(12.5px) / 1 var(--font-mono);
        color: var(--status-chit);
    }

    .tick {
        flex: none;
        width: 22px;
        height: 22px;
        box-sizing: border-box;
        border-radius: var(--radius-circle);
        border: 2px solid var(--overlay-3);
        position: relative;

        .done & {
            border: 0;
            background: var(--status-chit);

            &::after {
                content: "";
                position: absolute;
                inset: 0;
                margin: auto;
                width: 13px;
                height: 13px;
                mask: var(--icon-check) center/contain no-repeat;
                background: var(--on-accent);
            }
        }
    }
</style>
