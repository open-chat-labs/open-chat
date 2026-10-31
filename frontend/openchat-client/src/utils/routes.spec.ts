import { describe, expect, test } from "vitest";
import { selectedChannelRoute } from "./routes";

function ctx(channelId: string): PageJS.Context {
    return {
        params: { communityId: "community", channelId },
        querystring: "",
    } as PageJS.Context;
}

describe("selectedChannelRoute", () => {
    // Rollbar #32144 / #32091: a non-numeric channel id threw from BigInt and took down the app
    test("a channel id that isn't an integer shows the community instead of throwing", () => {
        for (const fav of [false, true]) {
            const route = selectedChannelRoute(fav)(ctx("example.com"));
            expect(route.kind).toBe("selected_community_route");
        }
    });
});
