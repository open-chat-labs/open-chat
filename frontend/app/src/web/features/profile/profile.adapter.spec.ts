import {
    AuthProvider,
    type ChitEvent,
    type CommunitySummary,
    type LinkedAuthenticationPrincipal,
    type Metrics,
    type PublicProfile,
    type UserSummary,
} from "@client";
import {
    botConfigProps,
    calendarDay,
    changedChatSettings,
    claimDays,
    claimedNow,
    communitiesProps,
    linkCodeProps,
    signinMethodsProps,
    memberDisplayNameOf,
    storageProps,
    chatSettingsProps,
    profileProps,
    ringtoneKeyOf,
    statsProps,
    themePrefOf,
    type AppChatSettings,
} from "./profile.adapter";

const user = {
    kind: "user",
    userId: "u1",
    username: "julian",
    displayName: "Julian",
    streak: 7,
    chitBalance: 1200,
    diamondStatus: "active",
    isUniquePerson: true,
} as UserSummary;

const profile: PublicProfile = {
    username: "julian",
    displayName: undefined,
    bio: "hello",
    isPremium: false,
    phoneIsVerified: false,
    created: 1_700_000_000_000n,
};

const settings: AppChatSettings = {
    enterSend: true,
    doubleClickReply: false,
    notificationsGranted: true,
    lowBandwidth: false,
    hideBlocked: true,
    cameraOn: false,
    micOn: true,
    speakerView: false,
    offensive: false,
    adult: true,
    underReview: false,
    ringtone: "garage",
};

describe("the profile dialog's props", () => {
    test("the profile pane", () => {
        const chit = { streak: 3, balance: 900 };
        const images = { avatarUrl: "/a.png", coverUrl: undefined };
        expect(profileProps("me", user, profile, chit, images)).toEqual({
            userId: "me",
            handle: "julian",
            name: "",
            about: "hello",
            joined: 1_700_000_000_000,
            streak: 3,
            balance: 900,
            isDiamond: true,
            isVerified: true,
            avatar: 'url("/a.png") center / cover no-repeat',
            cover: undefined,
        });
    });

    test("the stats pane", () => {
        const metrics = { textMessages: 10, reactions: 3, reportedMessages: 1 } as Metrics;
        const stats = statsProps(metrics, {
            minutesOnlineThisMonth: 30,
            minutesOnlineLastMonth: 20,
        });
        expect(stats.onlineMinutes).toBe(30);
        expect(stats.onlineMinutesPrev).toBe(20);
        expect(stats.messageMix[0]).toEqual({ label: "ui.statsDonut.types.text", count: 10 });
        expect(stats.engagement[0]).toEqual({ label: "stats.reactions", count: 3 });
        expect(stats.reported).toBe(1);
    });

    test("the chat settings, with the app's garage ringtone as the design's twostep", () => {
        const props = chatSettingsProps(settings);
        expect(props.ringtone).toBe("twostep");
        expect(props.doubleClick).toBe(false);
        expect(props.activeSpeaker).toBe(false);
        expect(ringtoneKeyOf("twostep")).toBe("garage");
        expect(ringtoneKeyOf("siren")).toBe("siren");
    });

    test("a ringtone the app no longer has shows as the default", () => {
        expect(chatSettingsProps({ ...settings, ringtone: "retired" }).ringtone).toBe("boring");
    });

    test("only the settings that changed are written", () => {
        const shown = chatSettingsProps(settings);
        expect(changedChatSettings(settings, { ...shown, lowBandwidth: true })).toEqual([
            "lowBandwidth",
        ]);
        expect(changedChatSettings(settings, shown)).toEqual([]);
    });

    test("picking the default ringtone replaces one the app no longer has", () => {
        const retired = { ...settings, ringtone: "retired" };
        const shown = chatSettingsProps(retired);
        expect(shown.ringtone).toBe("boring");
        expect(changedChatSettings(retired, shown)).toEqual(["ringtone"]);
    });

    test("a theme the design doesn't have shows as the system's", () => {
        expect(themePrefOf("dark")).toBe("dark");
        expect(themePrefOf("light")).toBe("light");
        expect(themePrefOf("system")).toBe("system");
        expect(themePrefOf("signals")).toBe("system");
    });

    test("the communities, and the name the user goes by in each that has one", () => {
        const community = (id: string, displayName?: string) =>
            ({
                id: { kind: "community", communityId: id },
                name: `Community ${id}`,
                membership: { displayName },
            }) as CommunitySummary;
        const props = communitiesProps([community("a", "Jules"), community("b")], () => "/c.png");
        expect(props.communities).toEqual([
            { id: "a", name: "Community a", avatar: 'url("/c.png") center / cover no-repeat' },
            { id: "b", name: "Community b", avatar: 'url("/c.png") center / cover no-repeat' },
        ]);
        expect(props.communityNames).toEqual({ a: "Jules" });
    });

    test("clearing a community name sends no name (removes it), not an empty string", () => {
        expect(memberDisplayNameOf(null)).toBeUndefined();
        expect(memberDisplayNameOf("")).toBeUndefined();
        expect(memberDisplayNameOf("Jules")).toBe("Jules");
        expect(memberDisplayNameOf("   ")).toBeUndefined();
        expect(memberDisplayNameOf(" Jules ")).toBe("Jules");
    });

    test("storage in MB, with no allowance kept at 0", () => {
        expect(storageProps({ bytesUsed: 5 * 1024 * 1024, byteLimit: 0 })).toEqual({
            storageUsedMB: 5,
            storageLimitMB: 0,
        });
    });

    test("the bot configuration", () => {
        expect(
            botConfigProps({ icHost: "h", openStorageIndexCanister: "s", ocPublicKey: "k" }),
        ).toEqual({ icHost: "h", storageIndex: "s", publicKey: "k" });
    });

    test("the sign-in methods the dialog has a place for, a passkey named by its provider", () => {
        const linked = (provider: AuthProvider, principal: string, extra = {}) =>
            ({
                provider,
                principal,
                originatingCanister: "c",
                isIIPrincipal: false,
                isCurrentIdentity: false,
                webAuthnKey: undefined,
                ...extra,
            }) as LinkedAuthenticationPrincipal;
        const methods = signinMethodsProps(
            [
                linked(AuthProvider.PASSKEY, "p1", {
                    passkeyProvider: "iCloud Keychain",
                    isCurrentIdentity: true,
                }),
                linked(AuthProvider.PASSKEY, "p2"),
                linked(AuthProvider.II, "i1"),
                linked(AuthProvider.ETH, "e1"),
            ],
            (type) => `name:${type}`,
        );
        expect(methods).toEqual([
            { type: "passkey", id: "p1", title: "iCloud Keychain", current: true },
            { type: "passkey", id: "p2", title: "name:passkey", current: false },
            { type: "ii", id: "i1", title: "name:ii", current: false },
        ]);
    });

    test("a device-link code expires in ms", () => {
        expect(linkCodeProps({ value: "ABC123", expiresAt: 1_700_000_000_000n })).toEqual({
            code: "ABC123",
            expiresAt: 1_700_000_000_000,
        });
    });
});

describe("the CHIT calendar's days", () => {
    const DAY = 24 * 60 * 60 * 1000;
    // 2026-03-01T00:00Z
    const MARCH_1 = Date.UTC(2026, 2, 1);
    const at = (ms: number, kind: ChitEvent["reason"]["kind"], amount = 0): ChitEvent =>
        ({ amount, timestamp: BigInt(ms), reason: { kind } }) as ChitEvent;
    const utc = () => 0;

    test("are the claims, insured days and reinstated claims, each with its streak day", () => {
        const events = [
            at(MARCH_1 + 2 * DAY + 600_000, "daily_claim", 30),
            at(MARCH_1 + 90 * 60_000, "daily_claim", 10),
            // an achievement isn't a claim
            at(MARCH_1 + 2 * 60 * 60_000, "achievement_unlocked", 500),
            at(MARCH_1 + DAY + 1000, "streak_insurance_claim"),
            at(MARCH_1 + 5 * DAY - 1, "daily_claim_reinstated"),
        ];
        expect(claimDays(events, utc)).toEqual([
            { day: "2026-03-01", streakDay: 1, amount: 10, minute: 90 },
            { day: "2026-03-02", streakDay: 2, insured: true },
            { day: "2026-03-03", streakDay: 3, amount: 30, minute: 10 },
            // after a gap, a streak starts again
            { day: "2026-03-05", streakDay: 1, amount: 0 },
        ]);
    });

    test("fall on the user's own days, which the streak follows", () => {
        // 23:30 UTC on the 1st is the 2nd at UTC+2, the day after a claim on the 1st there
        const events = [
            at(MARCH_1 + 60 * 60_000, "daily_claim", 10),
            at(MARCH_1 + DAY - 30 * 60_000, "daily_claim", 20),
        ];
        expect(claimDays(events, () => 120).map((d) => [d.day, d.streakDay])).toEqual([
            ["2026-03-01", 1],
            ["2026-03-02", 2],
        ]);
        // in UTC, both are on the 1st, but the backend counts a later claim on a later day
        expect(claimDays(events, utc).map((d) => d.day)).toEqual(["2026-03-01", "2026-03-02"]);
    });

    test("today and today's claim are the same day when the user's date isn't UTC's", () => {
        // 00:30 on the 2nd at UTC+2 is 22:30 on the 1st in UTC
        const now = MARCH_1 + DAY - 90 * 60_000;
        const plus2 = () => 120;
        const today = new Date(calendarDay(now, plus2)).toISOString().slice(0, 10);
        expect(today).toBe("2026-03-02");
        expect(claimedNow(now, 4, 200, plus2)).toEqual({
            day: today,
            streakDay: 4,
            amount: 200,
            minute: 22 * 60 + 30,
        });
        expect(claimDays([at(now, "daily_claim", 200)], plus2)[0].day).toBe(today);
    });

    test("an insured or reinstated day is the one its marker ends, in the zone it was claimed from", () => {
        // insured on the 2nd claimed from UTC-5: marked at its last ms there, 04:59:59.999 UTC
        // on the 3rd, which is the 3rd at UTC+2, where the browser is now
        const marker = MARCH_1 + 2 * DAY + 5 * 60 * 60_000 - 1;
        const plus2 = () => 120;
        const events = [
            at(MARCH_1 + 9 * 60 * 60_000, "daily_claim", 10),
            at(marker, "streak_insurance_claim"),
            at(MARCH_1 + 2 * DAY + 9 * 60 * 60_000, "daily_claim", 30),
        ];
        expect(claimDays(events, plus2)).toEqual([
            { day: "2026-03-01", streakDay: 1, amount: 10, minute: 9 * 60 },
            { day: "2026-03-02", streakDay: 2, insured: true },
            { day: "2026-03-03", streakDay: 3, amount: 30, minute: 9 * 60 },
        ]);
    });

    test("a claim after a marker comes on a later day, though this browser's zone puts it on the marker's", () => {
        // insured on the 2nd, marked at its last ms in UTC; the next claim, 02:00 UTC on the 3rd,
        // is the 2nd at UTC-5
        const events = [
            at(MARCH_1 + 2 * DAY - 1, "streak_insurance_claim"),
            at(MARCH_1 + 2 * DAY + 2 * 60 * 60_000, "daily_claim", 10),
        ];
        expect(claimDays(events, () => -300).map((d) => [d.day, d.insured ?? false])).toEqual([
            ["2026-03-02", true],
            ["2026-03-03", false],
        ]);
    });

    test("the claim before insured days is on the day before them, wherever it was made", () => {
        // claimed at 08:00 each day from UTC+10 (22:00 UTC the day before), day 2 missed and
        // insured, the calendar opened from UTC-5
        const H = 60 * 60_000;
        const claimAt = (day: number) => MARCH_1 + (day - 1) * DAY - 2 * H;
        // the last ms of the 2nd at UTC+10
        const marker = MARCH_1 + 2 * DAY - 10 * H - 1;
        const minus5 = () => -300;
        const events = [
            at(claimAt(1), "daily_claim", 10),
            at(marker, "streak_insurance_claim"),
            at(claimAt(3), "daily_claim", 30),
        ];
        expect(
            claimDays(events, minus5).map((d) => [d.day, d.streakDay, d.insured ?? false]),
        ).toEqual([
            ["2026-03-01", 1, false],
            ["2026-03-02", 2, true],
            ["2026-03-03", 3, false],
        ]);
    });

    test("a zone change at a claim doesn't move the claims after it off their days", () => {
        // home in UTC-5, claiming at 20:00 there (01:00 UTC the next day); day 5 claimed at 20:00
        // from UTC+9, day 6 missed and insured (marked in UTC+9), then home again for days 7-9
        const H = 60 * 60_000;
        const atHome = (day: number) => at(MARCH_1 + (day - 1) * DAY + 25 * H, "daily_claim", 10);
        const events = [
            ...[1, 2, 3, 4].map(atHome),
            at(MARCH_1 + 4 * DAY + 11 * H, "daily_claim", 10),
            at(MARCH_1 + 5 * DAY + 15 * H - 1, "streak_insurance_claim"),
            ...[7, 8, 9].map(atHome),
        ];
        const days = claimDays(events, () => -300);
        expect(days.map((d) => [Number(d.day.slice(-2)), d.streakDay, d.insured ?? false])).toEqual(
            [
                [1, 1, false],
                [2, 2, false],
                [3, 3, false],
                [4, 4, false],
                [5, 5, false],
                [6, 6, true],
                [7, 7, false],
                [8, 8, false],
                [9, 9, false],
            ],
        );
    });

    test("claims before the one before insured days stay before it, across a zone change", () => {
        // home in UTC+9: a claim at 20:00 on the 1st; then from UTC-5, claims at 08:00 on the 2nd
        // and 20:00 on the 3rd and 4th (01:00 UTC the next day); the 5th missed and insured
        const H = 60 * 60_000;
        const events = [
            at(MARCH_1 + 11 * H, "daily_claim", 10),
            at(MARCH_1 + DAY + 13 * H, "daily_claim", 10),
            at(MARCH_1 + 3 * DAY + H, "daily_claim", 10),
            at(MARCH_1 + 4 * DAY + H, "daily_claim", 10),
            // the last ms of the 5th at UTC-5
            at(MARCH_1 + 5 * DAY + 5 * H - 1, "streak_insurance_claim"),
        ];
        expect(
            claimDays(events, () => 540).map((d) => [Number(d.day.slice(-2)), d.streakDay]),
        ).toEqual([
            [1, 1],
            [2, 2],
            [3, 3],
            [4, 4],
            [5, 5],
        ]);
    });

    test("the claim that moved the user west is on the day before the insured ones", () => {
        // a claim at 20:00 on the 4th in UTC+9; then one at 10:30 on the 4th in UTC-5 (00:30 on
        // the 5th in UTC+9, which the backend counts it on); the 6th missed and insured in UTC-5
        const H = 60 * 60_000;
        const events = [
            at(MARCH_1 + 3 * DAY + 11 * H, "daily_claim", 10),
            at(MARCH_1 + 3 * DAY + 15.5 * H, "daily_claim", 20),
            at(MARCH_1 + 6 * DAY + 5 * H - 1, "streak_insurance_claim"),
        ];
        expect(
            claimDays(events, () => -300).map((d) => [Number(d.day.slice(-2)), d.streakDay]),
        ).toEqual([
            [4, 1],
            [5, 2],
            [6, 3],
        ]);
    });
});
