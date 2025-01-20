<script lang="ts">
    import AccountMultiple from "svelte-material-icons/AccountMultiple.svelte";
    import Pound from "svelte-material-icons/Pound.svelte";
    import type { AccessGateConfig, DataContent, OpenChat } from "openchat-client";
    import Avatar from "../../../Avatar.svelte";
    import IntersectionObserver from "../../IntersectionObserver.svelte";
    import { _ } from "svelte-i18n";
    import Markdown from "../../Markdown.svelte";
    import { AvatarSize, ModerationFlags } from "openchat-client";
    import { getContext } from "svelte";
    import CommunityBanner from "./CommunityBanner.svelte";
    import AccessGateIcon from "../../access/AccessGateIcon.svelte";
    import { i18nKey, supportedLanguagesByCode } from "../../../../i18n/i18n";
    import Translatable from "../../../Translatable.svelte";
    import Verified from "../../../icons/Verified.svelte";

    const client = getContext<OpenChat>("client");

    interface Props {
        id: string;
        name: string;
        description: string;
        avatar: DataContent;
        banner: DataContent;
        memberCount: number;
        channelCount: number;
        header?: boolean;
        gateConfig: AccessGateConfig;
        language: string;
        flags: number;
        verified: boolean;
    }

    let {
        id,
        name,
        description,
        avatar,
        banner,
        memberCount,
        channelCount,
        header = false,
        gateConfig,
        language,
        flags,
        verified,
    }: Props = $props();

    let flagsArray = $derived(serialiseFlags(flags));

    function serialiseFlags(flags: number) {
        const f: string[] = [supportedLanguagesByCode[language]?.name];
        if (client.hasModerationFlag(flags, ModerationFlags.Adult)) {
            f.push("communities.adult");
        }
        if (client.hasModerationFlag(flags, ModerationFlags.Offensive)) {
            f.push("communities.offensive");
        }
        if (client.hasModerationFlag(flags, ModerationFlags.UnderReview)) {
            f.push("communities.underReview");
        }
        return f;
    }
</script>

<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class:header class="card">
    <IntersectionObserver let:intersecting>
        <CommunityBanner {intersecting} square={header} {banner}>
            <div class="gate">
                <AccessGateIcon
                    clickable
                    button
                    level={"community"}
                    position={"bottom"}
                    align={"end"}
                    {gateConfig} />
            </div>
            <div class="avatar">
                <Avatar
                    url={client.communityAvatarUrl(id, avatar)}
                    userId={undefined}
                    size={AvatarSize.Default} />
            </div>
        </CommunityBanner>
    </IntersectionObserver>
    <div class="content">
        <div class="name">
            {name}
            {#if verified}
                <div class="verified">
                    <Verified
                        size={"medium"}
                        {verified}
                        tooltip={i18nKey("verified.verifiedCommunity")} />
                </div>
            {/if}
        </div>
        <div class="desc" class:fixed={!header}>
            <Markdown inline={false} text={description} />
        </div>
        {#if !header}
            <div class="footer">
                <div class="footer-row">
                    <div class="members" title={$_("members")}>
                        <span class="label"
                            ><AccountMultiple viewBox="0 -4 24 24" size={"1.2em"} /></span>
                        <span class="number">{memberCount.toLocaleString()}</span>
                    </div>
                    <div class="channels" title={$_("communities.publicChannels")}>
                        <span class="label"><Pound viewBox="0 -3 24 24" size={"1.2em"} /></span>
                        <span class="number">{channelCount.toLocaleString()}</span>
                    </div>
                </div>
                <div class="footer-row flags">
                    {#each flagsArray as flag}
                        <div class="flag"><Translatable resourceKey={i18nKey(flag)} /></div>
                    {/each}
                </div>
            </div>
        {/if}
    </div>
</div>

<style lang="scss">
    .card {
        cursor: pointer;
        background-color: var(--recommended-bg);
        border: var(--bw) solid var(--bd);
        border-radius: var(--card-rd);
        box-shadow: var(--card-sh);

        .avatar {
            width: toRem(48);
            height: toRem(48);
            position: absolute;
            bottom: toRem(-24);
            left: $sp4;
        }

        .gate {
            position: absolute;
            top: $sp4;
            right: $sp4;
        }

        &.header {
            border-radius: 0;
            border: none;
        }

        .content {
            padding: toRem(16);
            padding-top: toRem(28);

            .name {
                @include font(bold, normal, fs-130);
                margin-bottom: $sp3;
                display: flex;
                gap: $sp2;
                align-items: center;
            }

            .desc {
                @include font(book, normal, fs-100, 28);
                color: var(--txt-light);
                margin-bottom: $sp4;
                max-height: toRem(130);
                @include nice-scrollbar();
                overflow-wrap: anywhere;

                :global(.markdown-wrapper pre) {
                    text-wrap: auto;
                }

                &.fixed {
                    height: toRem(130);
                }
            }

            .footer {
                border-top: 1px solid var(--bd);
                padding-top: $sp4;
                margin-top: $sp4;

                .footer-row {
                    display: flex;
                    justify-content: space-between;
                    gap: $sp3;
                    margin-bottom: 12px;
                    .members,
                    .channels {
                        background-color: var(--input-bg);
                        padding: $sp1 $sp3;
                        border-radius: var(--rd);
                        .number {
                            font-weight: 500;
                        }
                        .label {
                            color: var(--txt-light);
                        }
                    }
                }
            }

            .flags {
                @include font(book, normal, fs-80);
                justify-content: flex-start !important;
                margin-bottom: 0 !important;
                display: flex;
                gap: $sp2;
                flex-wrap: wrap;

                .flag {
                    background-color: var(--button-bg);
                    color: var(--button-txt);
                    padding: $sp1 $sp3;
                    border-radius: var(--rd);
                }
            }
        }
    }
</style>
