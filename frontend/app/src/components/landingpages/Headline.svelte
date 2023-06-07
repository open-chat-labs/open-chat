<h2><slot /></h2>

<style lang="scss">
    h2 {
        margin: 0;
        @include font(medium, normal, fs-230, 68);
        margin-bottom: toRem(60);

        @include mobile() {
            @include font(medium, normal, fs-180, 45);
            margin-bottom: toRem(40);
        }
    }
</style>
