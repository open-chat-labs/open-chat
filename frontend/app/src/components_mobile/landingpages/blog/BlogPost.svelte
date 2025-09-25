<script lang="ts">
</script>

<div class="blog-post">
    <slot />
</div>

<style lang="scss">
    :global {
        .blog-post {
            padding-bottom: $sp5;
            border-bottom: 1px solid var(--landing-bd);
            margin-bottom: $sp6;

            section {
                margin-bottom: $sp5;
            }

            h2 {
                @include font(bold, normal, fs-160);
                margin-bottom: $sp4;
            }

            h3 {
                @include font(bold, normal, fs-120);
                margin-bottom: $sp4;
            }

            a {
                color: var(--landing-txt);
                text-decoration: underline;
            }

            p,
            ul {
                @include font(book, normal, fs-100, 28);
                margin-bottom: $sp4;
            }

            ul {
                @include bullet_list();
            }
        }
    }
</style>
