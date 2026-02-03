/** A bunch of feature flags that we _might_ need for app store review */

export const disableWalletFeature = import.meta.env.OC_DISABLE_WALLET === "true";

export const disableTipsFeature =
    disableWalletFeature || import.meta.env.OC_DISABLE_TIPS === "true";

export const disableCreatePrizeFeature =
    disableWalletFeature || import.meta.env.OC_DISABLE_CREATE_PRIZE === "true";
