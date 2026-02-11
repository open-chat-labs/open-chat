/** A bunch of feature flags that we _might_ need for app store review
 * This really boils down to two things: disabling _payments_ or disabling the whole wallet
 */

export const disableWalletFeature = import.meta.env.OC_APP_STORE === "true";

export const disableCryptoPaymentsFeature = disableWalletFeature;

export const disableTipsFeature = disableCryptoPaymentsFeature;

export const disableCreatePrizeFeature = disableCryptoPaymentsFeature;

export const disableClaimPrizeFeature = disableWalletFeature;

export const disableSendCryptoFeature = disableCryptoPaymentsFeature;

export const disableReceiveCryptoFeature = disableWalletFeature;

export const disableP2PSwapFeature = disableCryptoPaymentsFeature;

export const disableSwapFeature = disableCryptoPaymentsFeature;

export const disableDiamondPaymentFeature = disableCryptoPaymentsFeature;

export const disableMakeProposalFeature = disableCryptoPaymentsFeature;
