// The state of a prize being made, shared by every tree's prize builder: its winners, how its fund
// is split, how long it runs and who can claim it, which are remembered for the next prize. What it
// costs and how its fund is split are @client's (`prizeCosts`, `newPrizeContent`).

import {
    LocalStorageStore,
    localUpdates,
    MAX_PRIZE_EXCLUDED_USERS,
    newPrizeContent,
    ONE_DAY,
    ONE_HOUR,
    ONE_WEEK,
    prizeCosts,
    prizeMaximum,
    validateTokenInput,
    validPrizeWinners,
    type ChatIdentifier,
    type MessageContext,
    type PrizeContentInitial,
    type PrizeCosts,
    type PrizeDiamond,
    type PrizeDistribution,
} from "@client";

/** What a prize builder remembers from the last prize made. */
export type PrizeConfig = {
    distribution: PrizeDistribution;
    durationMs: number;
    diamond: PrizeDiamond;
    minStreak: number;
    minChitEarned: number;
    /** An account registered at least this long ago, in ms; 0 for none. */
    minAccountAgeMs: number;
    /** Users who can't claim it (user ids), remembered only on this device. */
    excludedUsers: string[];
};

export const DEFAULT_PRIZE_CONFIG: PrizeConfig = {
    distribution: "random",
    durationMs: ONE_DAY,
    diamond: "none",
    minStreak: 0,
    minChitEarned: 0,
    minAccountAgeMs: 0,
    excludedUsers: [],
};

// shared by every tree, which have stored it in their own ways
const PRIZE_CONFIG_KEY = "openchat_prize_config";

// the old desktop builder stored its duration by name
const NAMED_DURATIONS: Record<string, number> = {
    oneHour: ONE_HOUR,
    oneDay: ONE_DAY,
    oneWeek: ONE_WEEK,
};

function field(raw: object, key: string): unknown {
    return Reflect.get(raw, key);
}

function userIds(value: unknown): string[] {
    if (!Array.isArray(value)) return [];
    const ids = value.filter((v): v is string => typeof v === "string");
    return [...new Set(ids)].slice(0, MAX_PRIZE_EXCLUDED_USERS);
}

function count(value: unknown): number {
    const n = typeof value === "string" ? Number(value) : value;
    return typeof n === "number" && Number.isFinite(n) && n >= 0 ? n : 0;
}

/**
 * The remembered prize settings, as any tree stored them: the old desktop builder named its
 * duration ("oneDay"), the mobile one stored it as a bigint, which `JSON.stringify` writes as a
 * string of its digits (and which was then added to the time as a string, its end date's digits
 * run together). Anything unreadable is the default. Unique-person gating is suspended, so it's
 * never read back.
 */
export function parsePrizeConfig(text: string): PrizeConfig {
    let raw: unknown;
    try {
        raw = JSON.parse(text);
    } catch {
        return DEFAULT_PRIZE_CONFIG;
    }
    if (typeof raw !== "object" || raw === null) return DEFAULT_PRIZE_CONFIG;
    const distribution = field(raw, "distribution");
    const diamond = field(raw, "diamond");
    const duration = field(raw, "durationMs") ?? field(raw, "duration");
    const durationMs =
        typeof duration === "string" && duration in NAMED_DURATIONS
            ? NAMED_DURATIONS[duration]
            : count(duration);
    return {
        distribution: distribution === "equal" ? "equal" : "random",
        durationMs: durationMs > 0 ? durationMs : DEFAULT_PRIZE_CONFIG.durationMs,
        diamond: diamond === "standard" || diamond === "lifetime" ? diamond : "none",
        minStreak: count(field(raw, "minStreak")),
        minChitEarned: count(field(raw, "minChitEarned")),
        minAccountAgeMs: count(field(raw, "minAccountAgeMs")),
        excludedUsers: userIds(field(raw, "excludedUsers")),
    };
}

/** The token a prize is paid in, as the registry has it. */
export type PrizeToken = { ledger: string; symbol: string; decimals: number; transferFee: bigint };

export class PrizeForm {
    #config = new LocalStorageStore<PrizeConfig>(
        PRIZE_CONFIG_KEY,
        DEFAULT_PRIZE_CONFIG,
        JSON.stringify,
        parsePrizeConfig,
        () => false,
    );

    winners = $state<number | undefined>(20);
    distribution = $state<PrizeDistribution>(this.#config.value.distribution);
    durationMs = $state<number>(this.#config.value.durationMs);
    diamond = $state<PrizeDiamond>(this.#config.value.diamond);
    minStreak = $state<number>(this.#config.value.minStreak);
    minChitEarned = $state<number>(this.#config.value.minChitEarned);
    minAccountAgeMs = $state<number>(this.#config.value.minAccountAgeMs);
    excludedUsers = $state<string[]>(this.#config.value.excludedUsers);

    /** Takes what a builder that keeps its own form (the new UI's) picked. */
    choose(choices: PrizeConfig & { winners: number }): void {
        this.winners = choices.winners;
        this.distribution = choices.distribution;
        this.durationMs = choices.durationMs;
        this.diamond = choices.diamond;
        this.minStreak = choices.minStreak;
        this.minChitEarned = choices.minChitEarned;
        this.minAccountAgeMs = choices.minAccountAgeMs;
        this.excludedUsers = choices.excludedUsers;
    }

    get canExcludeMore(): boolean {
        return this.excludedUsers.length < MAX_PRIZE_EXCLUDED_USERS;
    }

    /** Excludes `userId` from claiming, unless they already are or the list is full. */
    exclude(userId: string): void {
        if (this.canExcludeMore && !this.excludedUsers.includes(userId)) {
            this.excludedUsers = [...this.excludedUsers, userId];
        }
    }

    unexclude(userId: string): void {
        this.excludedUsers = this.excludedUsers.filter((u) => u !== userId);
    }

    get validWinners(): boolean {
        return validPrizeWinners(this.winners);
    }

    /** A Diamond restriction picked again is dropped; a lifetime one replaces a standard one. */
    toggleDiamond(kind: "standard" | "lifetime"): void {
        this.diamond = this.diamond === kind ? "none" : kind;
    }

    /** What a fund of `amount` costs with these winners. */
    costs(amount: bigint, transferFee: bigint): PrizeCosts {
        return prizeCosts(amount, this.winners ?? 0, transferFee);
    }

    /**
     * The prize to send in `chatId`, funded with `amount` (`from`: an external wallet that has
     * approved it, or one a draft will ask); none without valid winners, or in a DM.
     */
    content(
        chatId: ChatIdentifier,
        token: PrizeToken,
        amount: bigint,
        from?: { fromAccount?: string; fromWallet?: string },
        now: number = Date.now(),
    ): PrizeContentInitial | undefined {
        if (!validPrizeWinners(this.winners)) return undefined;
        return newPrizeContent(
            {
                chatId,
                ledger: token.ledger,
                symbol: token.symbol,
                transferFee: token.transferFee,
                amount,
                winners: this.winners,
                distribution: this.distribution,
                durationMs: this.durationMs,
                diamond: this.diamond,
                minStreak: this.minStreak,
                minChitEarned: this.minChitEarned,
                minAccountAgeMs: this.minAccountAgeMs,
                excludedUsers: this.excludedUsers,
                from,
            },
            now,
        );
    }

    /** Remembers the split, the duration and the restrictions for the next prize. */
    remember(): void {
        this.#config.set({
            distribution: this.distribution,
            durationMs: this.durationMs,
            diamond: this.diamond,
            minStreak: this.minStreak,
            minChitEarned: this.minChitEarned,
            minAccountAgeMs: this.minAccountAgeMs,
            excludedUsers: this.excludedUsers,
        });
    }

    /**
     * Attaches the prize to the message being written; its fund is taken when the message is
     * sent. An external wallet's approval is not asked for here (`fromWallet`: the send asks).
     */
    attach(
        messageContext: MessageContext,
        token: PrizeToken,
        amount: bigint,
        fromWallet?: string,
    ): boolean {
        const content = this.content(messageContext.chatId, token, amount, { fromWallet });
        if (content === undefined) return false;
        localUpdates.draftMessages.setAttachment(messageContext, content);
        this.remember();
        return true;
    }

    /**
     * Attaches the prize a builder that keeps its own form asks for (the new UI's
     * `PrizeBuilderDialog`), its fund `amountText` as typed (read with `validateTokenInput`, so
     * exactly what was typed in the token's smallest unit), paid from the OpenChat account's
     * `balance`: only where it's at least the minimum and the balance covers it with its fees.
     */
    attachTyped(
        messageContext: MessageContext,
        token: PrizeToken,
        balance: bigint,
        amountText: string,
    ): "attached" | "invalid" {
        if (!validPrizeWinners(this.winners)) return "invalid";
        const amount = validateTokenInput(amountText, token.decimals).amount;
        const { minAmount } = this.costs(amount, token.transferFee);
        const max = prizeMaximum(balance, amount, this.winners, token.transferFee);
        if (amount <= 0n || amount < minAmount || amount > max) return "invalid";
        return this.attach(messageContext, token, amount) ? "attached" : "invalid";
    }
}
