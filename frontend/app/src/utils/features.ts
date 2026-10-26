/** A bunch of feature flags that we _might_ need for app store review
 * This really boils down to two things: disabling _payments_ or disabling the whole wallet
 */

export const appStoreBuild = import.meta.env.OC_APP_STORE === "true";

export const disableWalletFeature = appStoreBuild;

export const disableCryptoPaymentsFeature = disableWalletFeature;

export const disableTipsFeature = disableCryptoPaymentsFeature;

export const disableCreatePrizeFeature = disableCryptoPaymentsFeature;

export const disableClaimPrizeFeature = disableWalletFeature;

export const disableSendCryptoFeature = disableCryptoPaymentsFeature;

export const disableReceiveCryptoFeature = disableWalletFeature;

export const disableP2PSwapFeature = disableCryptoPaymentsFeature;

export const disableSwapFeature = disableCryptoPaymentsFeature;

export const disableDiamondPaymentFeature = disableCryptoPaymentsFeature;

/** Diamond is paid in CHAT in production, and ICP elsewhere (test ledgers), unless the user picks the other. */
export const diamondPaysInChat = import.meta.env.OC_NODE_ENV === "production";

export const disableMakeProposalFeature = disableCryptoPaymentsFeature;

export const disableRestrictedContent = appStoreBuild;
