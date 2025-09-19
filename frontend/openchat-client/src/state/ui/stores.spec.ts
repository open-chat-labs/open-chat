import { ScreenWidth } from "openchat-shared";
import { routeStore } from "../path/stores";
import { dimensions, fullWidth, layout, mobileWidth, screenWidth } from "./stores";

describe("layout stores", () => {
    beforeEach(() => {
        routeStore.set({ kind: "chat_list_route", scope: { kind: "chats" } });
        dimensions.set({ width: 100, height: 100 });
    });

    test("screenWidth", () => {
        screenWidth.subscribe((_) => {});
        expect(screenWidth.value).toEqual(ScreenWidth.ExtraExtraSmall);
        dimensions.set({ width: 900, height: 100 });
        expect(screenWidth.value).toEqual(ScreenWidth.Medium);
    });

    test("fullWidth", () => {
        fullWidth.subscribe((_) => {});
        expect(fullWidth.value).toEqual(false);
        dimensions.set({ width: 2000, height: 100 });
        expect(fullWidth.value).toEqual(true);
    });

    test("mobileWidth", () => {
        mobileWidth.subscribe((_) => {});
        expect(mobileWidth.value).toEqual(true);
        dimensions.set({ width: 2000, height: 100 });
        expect(mobileWidth.value).toEqual(false);
    });

    test("layout", () => {
        layout.subscribe((_) => {});
        expect(layout.value).toMatchObject({ showMiddle: false, showNav: true });
        dimensions.set({ width: 2000, height: 100 });
        expect(layout.value).toMatchObject({ showMiddle: true, showNav: true });
    });

    test("layout selected chat", () => {
        routeStore.set({
            kind: "global_chat_selected_route",
            chatId: { kind: "group_chat", groupId: "123456" },
            chatType: "group_chat",
            open: false,
            scope: { kind: "chats" },
        });
        layout.subscribe((_) => {});
        expect(layout.value).toMatchObject({ showMiddle: true, showNav: false });
        dimensions.set({ width: 2000, height: 100 });
        expect(layout.value).toMatchObject({ showMiddle: true, showNav: true });
        dimensions.set({ width: 100, height: 100 });
        expect(layout.value).toMatchObject({ showMiddle: true, showNav: false });
    });
});
