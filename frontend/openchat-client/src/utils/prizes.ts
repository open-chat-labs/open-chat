import { i18nKey, type PrizeContent, type ResourceKey } from "@shared";

/** Who is looking at a prize, and what they hold that its requirements ask about. */
export type PrizeReader = {
    /** The reader sent it. */
    mine: boolean;
    direct: boolean;
    /** Previewing the chat, or their membership has lapsed. */
    previewingOrLapsed: boolean;
    /** Now, in ms. */
    now: number;
    diamond: boolean;
    lifetimeDiamond: boolean;
    streak: number;
    chitEarned: number;
};

export type PrizeView = {
    finished: boolean;
    claimedByYou: boolean;
    allClaimed: boolean;
    /** The reader meets every requirement (unique person gating is suspended). */
    eligible: boolean;
    /** Claim is offered: not in a DM, not to its sender, nor once it's over for the reader. */
    canClaim: boolean;
    /** Its requirements, and whether the reader meets each. */
    gates: { label: ResourceKey; met: boolean }[];
};

export function prizeView(content: PrizeContent, reader: PrizeReader): PrizeView {
    const finished = reader.now >= Number(content.endDate);
    const claimedByYou = content.userIsWinner;
    const allClaimed = content.prizesRemaining <= 0;
    const gates: PrizeView["gates"] = [];
    if (content.lifetimeDiamondOnly) {
        gates.push({
            label: i18nKey("prizes.lifetimeDiamondMembership"),
            met: reader.lifetimeDiamond,
        });
    } else if (content.diamondOnly) {
        gates.push({ label: i18nKey("prizes.diamondMembership"), met: reader.diamond });
    }
    if (content.streakOnly > 0) {
        gates.push({
            label: i18nKey("prizes.streakFull", { n: content.streakOnly }),
            met: reader.streak >= content.streakOnly,
        });
    }
    if (content.minChitEarned > 0) {
        gates.push({
            label: i18nKey("prizes.minChitEarnedValue", { n: content.minChitEarned }),
            met: reader.chitEarned >= content.minChitEarned,
        });
    }
    const eligible =
        (!content.diamondOnly || reader.diamond) &&
        (!content.lifetimeDiamondOnly || reader.lifetimeDiamond) &&
        content.streakOnly <= reader.streak &&
        content.minChitEarned <= reader.chitEarned;
    return {
        finished,
        claimedByYou,
        allClaimed,
        eligible,
        canClaim:
            !reader.direct &&
            !reader.mine &&
            !reader.previewingOrLapsed &&
            !finished &&
            !claimedByYou &&
            !allClaimed &&
            eligible,
        gates,
    };
}

/** A click the user made: a script's synthetic click can't claim a prize (claimPrize). */
export function isTrustedClick(e: MouseEvent): boolean {
    return e instanceof MouseEvent && e.isTrusted && e.type === "click";
}
