import ErrorComponent from "./ErrorComponent.svelte";
export default class errorBoundary extends ErrorComponent {
    constructor(config) {
        var error = null;
        config.props.$$slots.default = config.props.$$slots.default.map((render) => (...args) => {
            try {
                return render(...args);
            } catch (e) {
                console.log("Error rendering component: ", e, args);
                error = e;
            }
        });
        super(config);
        if (error) {
            this.$set({ error: error });
        }
    }
}
