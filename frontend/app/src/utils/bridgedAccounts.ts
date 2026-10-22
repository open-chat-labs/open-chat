import type { BridgedUserSummary, BridgePlatform, OpenChat } from "@client";
import { openExternalUrl } from "./urls";

// Where each platform's bridge takes a user to link their account there, with "{code}" in place of
// the code the UserIndex gave them. A platform without one can't be linked.
const LINK_URLS: Record<BridgePlatform, string> = {
    discord: import.meta.env.OC_DISCORD_BRIDGE_LINK_URL ?? "",
    telegram: import.meta.env.OC_TELEGRAM_BRIDGE_LINK_URL ?? "",
};

export const linkablePlatforms: BridgePlatform[] = (["discord", "telegram"] as const).filter(
    (platform) => LINK_URLS[platform] !== "",
);

// Each platform's logo, eg. at the start of its row in the user's linked accounts
export const BRIDGE_PLATFORM_ICONS: Record<BridgePlatform, string> = {
    discord: "/assets/discord.svg",
    telegram: "/assets/telegram.svg",
};

export type BridgedAccountRow =
    // The linked accounts haven't loaded, so it's not known yet whether to offer a link
    | { kind: "loading"; platform: BridgePlatform }
    | { kind: "linked"; platform: BridgePlatform; account: BridgedUserSummary }
    | { kind: "linkable"; platform: BridgePlatform }
    // The platform has no link URL, eg. Discord before its bridge is live
    | { kind: "unavailable"; platform: BridgePlatform };

// A row per platform, Telegram first, whether or not it can be linked. A user links one account per
// platform, so a platform is offered only while they have none linked there. To switch accounts,
// they unlink the linked one first. Accounts linked before that limit show one at a time.
export function bridgedAccountRows(
    linked: BridgedUserSummary[] | undefined,
    linkable: BridgePlatform[] = linkablePlatforms,
): BridgedAccountRow[] {
    return (["telegram", "discord"] as const).map((platform): BridgedAccountRow => {
        const account = linked?.find((a) => a.user.kind === platform);
        if (account !== undefined) {
            return { kind: "linked", platform, account };
        }
        if (linked === undefined) {
            return { kind: "loading", platform };
        }
        return { kind: linkable.includes(platform) ? "linkable" : "unavailable", platform };
    });
}

// Opens a linked account's profile page on its platform, from `bridgedProfileUrl`
export function openBridgedProfile(client: OpenChat, url: string) {
    openExternalUrl(client, url).catch((error) => {
        console.error("Failed to open the account's profile", error);
    });
}

// Takes the user to the platform's bridge with a new code, eg. Discord's bridge sends them through
// Discord's OAuth. On the web the tab is opened before the code is fetched, as browsers block one
// opened later than the click. Returns whether the user was sent there.
export async function linkBridgedAccount(
    client: OpenChat,
    platform: BridgePlatform,
): Promise<boolean> {
    const tab = client.isNativeApp() ? null : window.open("", "_blank");
    if (tab !== null) {
        tab.opener = null;
    }

    const resp = await client.startBridgedUserLink(platform).catch(() => undefined);
    if (resp?.kind !== "success") {
        tab?.close();
        return false;
    }

    const url = LINK_URLS[platform].replace("{code}", encodeURIComponent(resp.code));
    if (tab !== null) {
        tab.location.href = url;
    } else if (client.isNativeApp()) {
        await openExternalUrl(client, url);
    } else {
        // The browser blocked the tab
        window.location.assign(url);
    }
    return true;
}
