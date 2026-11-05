import { tabBarTabs, type TabBarData } from "./tabBar.adapter";

const data: TabBarData = {
    labels: {
        chats: "Chats",
        communities: "Communities",
        wallet: "Wallet",
        activity: "Activity",
        you: "You",
    },
    chatsUnread: 3,
    activityUnread: true,
    photoUrl: "https://example.com/me.png",
    wallet: true,
};

describe("the tab bar's tabs", () => {
    test("are the five tabs in order, with their names and icons", () => {
        expect(tabBarTabs(data).map((t) => [t.id, t.label, t.icon])).toEqual([
            ["chats", "Chats", "chat"],
            ["communities", "Communities", "community"],
            ["wallet", "Wallet", "wallet"],
            ["activity", "Activity", "bell"],
            ["you", "You", "user"],
        ]);
    });

    test("carry the unread count on Chats, the dot on Activity and the photo on You", () => {
        const tabs = tabBarTabs(data);
        expect(tabs.find((t) => t.id === "chats")?.count).toBe(3);
        expect(tabs.find((t) => t.id === "activity")?.dot).toBe(true);
        expect(tabs.find((t) => t.id === "you")?.avatarUrl).toBe("https://example.com/me.png");
        expect(tabs.filter((t) => t.count !== undefined).map((t) => t.id)).toEqual(["chats"]);
        expect(tabs.filter((t) => t.dot !== undefined).map((t) => t.id)).toEqual(["activity"]);
    });

    test("leave the wallet out of a build without it", () => {
        expect(tabBarTabs({ ...data, wallet: false }).map((t) => t.id)).toEqual([
            "chats",
            "communities",
            "activity",
            "you",
        ]);
    });
});
