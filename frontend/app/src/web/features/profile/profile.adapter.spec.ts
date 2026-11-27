import {
    AuthProvider,
    OPENCHAT_BOT_AVATAR_URL,
    OPENCHAT_BOT_USER_ID,
    type CommunitySummary,
    type LinkedAuthenticationPrincipal,
    type Metrics,
    type PublicProfile,
    type UserSummary,
} from "@client";
import {
    botConfigProps,
    changedChatSettings,
    communitiesProps,
    linkCodeProps,
    signinMethodsProps,
    storageProps,
    chatSettingsProps,
    profileAvatarUrl,
    profileProps,
    ringtoneKeyOf,
    statsProps,
    type AppChatSettings,
} from "./profile.adapter";
import { AVATAR_GRADIENTS } from "@openchat/ui/src/lib/components/Avatar.svelte";
import { senderColor } from "@src/logic/conversation/messageRow";

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
            isVerified: false,
            avatar: 'url("/a.png") center / cover no-repeat',
            cover: undefined,
        });
    });

    test("the user's swatch in place of a picture of their own", () => {
        const chit = { streak: 0, balance: 0 };
        const props = profileProps("me", user, profile, chit, {
            avatarUrl: undefined,
            coverUrl: undefined,
        });
        expect(props.avatar).toBe(AVATAR_GRADIENTS[senderColor("me")]);
    });

    // #10193 invariant 1: ProfileDialog never shows the verified badge while the gate is suspended
    test("never marks the user verified, even one whose record says they're a unique person", () => {
        const chit = { streak: 0, balance: 0 };
        const images = { avatarUrl: "/a.png", coverUrl: undefined };
        for (const isUniquePerson of [true, false]) {
            const props = profileProps("me", { ...user, isUniquePerson }, profile, chit, images);
            expect(props.isVerified).toBe(false);
        }
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

    test("the communities, and the name the user goes by in each that has one", () => {
        const community = (id: string, displayName?: string, avatar?: string) =>
            ({
                id: { kind: "community", communityId: id },
                name: `Community ${id}`,
                avatar: { blobUrl: avatar },
                membership: { displayName },
            }) as CommunitySummary;
        const props = communitiesProps([community("a", "Jules", "/c.png"), community("b")]);
        expect(props.communities).toEqual([
            {
                id: "a",
                name: "Community a",
                color: senderColor("a"),
                avatar: 'url("/c.png") center / cover no-repeat',
            },
            // no picture of its own: its swatch
            { id: "b", name: "Community b", color: senderColor("b"), avatar: undefined },
        ]);
        expect(props.communityNames).toEqual({ a: "Jules" });
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
                lastUsed: undefined,
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
            (lastUsed) => `used:${lastUsed}`,
        );
        expect(methods).toEqual([
            { type: "passkey", id: "p1", title: "iCloud Keychain", current: true },
            { type: "passkey", id: "p2", title: "name:passkey", current: false },
            { type: "ii", id: "i1", title: "name:ii", current: false },
        ]);
    });

    test("a sign-in method's last used line, only where the identity canister has a record", () => {
        const linked = (principal: string, lastUsed: bigint | undefined) =>
            ({
                provider: AuthProvider.II,
                principal,
                originatingCanister: "c",
                isIIPrincipal: true,
                isCurrentIdentity: false,
                webAuthnKey: undefined,
                lastUsed,
            }) as LinkedAuthenticationPrincipal;
        const methods = signinMethodsProps(
            [linked("i1", 1_700_000_000_000n), linked("i2", undefined)],
            (type) => `name:${type}`,
            (lastUsed) => `used:${lastUsed}`,
        );
        expect(methods.map((m) => m.used)).toEqual(["used:1700000000000", undefined]);
    });

    test("a device-link code expires in ms", () => {
        expect(linkCodeProps({ value: "ABC123", expiresAt: 1_700_000_000_000n })).toEqual({
            code: "ABC123",
            expiresAt: 1_700_000_000_000,
        });
    });
});

describe("someone's own picture from their profile", () => {
    const pattern = "https://{canisterId}.raw.icp0.io/{blobType}";

    test("is their avatar", () => {
        expect(profileAvatarUrl(pattern, "rturd-qaaaa-aaaaf-aabaq-cai", 7n)).toBe(
            "https://rturd-qaaaa-aaaaf-aabaq-cai.raw.icp0.io/avatar/7",
        );
    });

    test("is none without one (their swatch), not a generated identicon", () => {
        expect(profileAvatarUrl(pattern, "rturd-qaaaa-aaaaf-aabaq-cai", undefined)).toBeUndefined();
    });

    test("is a system user's fixed picture", () => {
        expect(profileAvatarUrl(pattern, OPENCHAT_BOT_USER_ID, undefined)).toBe(
            OPENCHAT_BOT_AVATAR_URL,
        );
    });
});
