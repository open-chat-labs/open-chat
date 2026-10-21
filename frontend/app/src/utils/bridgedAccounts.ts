import type { BridgePlatform, OpenChat } from "@client";
import { openExternalUrl } from "./urls";

// Where each platform's bridge takes a user to link their account there, with "{code}" in place of
// the code the UserIndex gave them. A platform without one isn't offered.
const LINK_URLS: Record<BridgePlatform, string> = {
    discord: import.meta.env.OC_DISCORD_BRIDGE_LINK_URL ?? "",
    telegram: import.meta.env.OC_TELEGRAM_BRIDGE_LINK_URL ?? "",
};

export const linkablePlatforms: BridgePlatform[] = (["discord", "telegram"] as const).filter(
    (platform) => LINK_URLS[platform] !== "",
);

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
