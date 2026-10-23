import type { CommunitySummary, Metrics, PublicProfile, UserSummary } from "@client";
import {
    botConfigProps,
    changedChatSettings,
    communitiesProps,
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
});
