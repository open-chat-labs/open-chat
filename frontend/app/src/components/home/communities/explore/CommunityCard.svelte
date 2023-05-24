<script lang="ts">
    import type { Community } from "openchat-client";
    import ButtonGroup from "../../../ButtonGroup.svelte";
    import Button from "../../../Button.svelte";

    export let community: Community;
    export let selected: boolean;
    export let header = false;
</script>

<div class:selected class:header on:click class="card">
    <div class="banner">
        <div class="avatar" />
    </div>
    <div class="content">
        <div class="name">{community.name}</div>
        <div class="desc">{community.description}</div>
        {#if !header}
            <ButtonGroup align={"fill"}>
                <Button tiny hollow>Preview</Button>
                <Button tiny>Join</Button>
            </ButtonGroup>
            <div class="footer">
                <div class="members">
                    <span class="number">{community.memberCount.toLocaleString()}</span>
                    <span class="label">{"members"}</span>
                </div>

                <div on:click class="channels">
                    <span class="number">{community.channelCount.toLocaleString()}</span>
                    <span class="label">{"channels"}</span>
                </div>
            </div>
        {/if}
    </div>
</div>

<style type="text/scss">
    .card {
        cursor: pointer;
        background-color: var(--recommended-bg);
        border: 1px solid var(--bd);
        border-radius: $sp3;

        &.selected {
            border-color: var(--txt);
        }

        .banner {
            position: relative;
            background-color: blueviolet;
            height: 150px;
            border-radius: $sp3 $sp3 0 0;

            .avatar {
                width: toRem(48);
                height: toRem(48);
                position: absolute;
                bottom: toRem(-15);
                left: $sp3;
                border-radius: 50%;
                background-color: orange;
            }
        }

        &.header {
            border-radius: 0;
            border: none;
            .banner {
                border-radius: 0;
            }
        }

        .content {
            padding: $sp4;
            padding-top: $sp5;

            .name {
                @include font(bold, normal, fs-130);
                margin-bottom: $sp3;
            }

            .desc {
                @include font(book, normal, fs-100, 28);
                color: var(--txt-light);
                margin-bottom: $sp4;
            }

            .footer {
                border-top: 1px solid var(--bd);
                padding-top: $sp4;
                margin-top: $sp4;
                display: flex;
                justify-content: space-between;
                gap: $sp3;

                .members,
                .channels {
                    .number {
                        font-weight: 500;
                    }
                    .label {
                        color: var(--txt-light);
                    }
                }

                .channels {
                    cursor: pointer;
                    text-decoration: underline;
                }
            }
        }
    }
</style>
