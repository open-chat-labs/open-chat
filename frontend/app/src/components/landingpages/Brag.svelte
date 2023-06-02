<script lang="ts">
    export let avatar: string;
    export let username: string;
    export let date: number;
    export let title: string;
    export let visible: boolean;

    $: dateStr = new Date(date).toLocaleDateString();
</script>

<div class="brag" class:visible>
    <div class="quote">"{title}"</div>
    <div class="footer">
        <img class="avatar" src={avatar} alt="user avatar" />
        <span class="username">{username}</span>
        <span class="date">{dateStr}</span>
    </div>
</div>

<style lang="scss">
    .brag {
        position: absolute;
        top: 50%;
        transform: translateY(-50%);
        transition: opacity 1s ease-in-out;
        text-align: left;
        opacity: 0;

        &.visible {
            opacity: 1;
        }

        .avatar {
            width: toRem(32);
            height: toRem(32);
            border-radius: 50%;
        }

        .quote {
            @include font(bold, normal, fs-230);
            margin-bottom: $sp4;

            @include mobile() {
                @include font(medium, normal, fs-160);
            }
        }

        .footer {
            display: flex;
            gap: $sp4;

            .username {
                @include font(bold, normal, fs-100);
            }
        }
    }
</style>
