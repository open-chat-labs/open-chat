import "page";
import { vi } from "vitest";
import { pathState } from "./path.svelte";
import { ScreenWidth, ui } from "./ui.svelte";

// eslint-disable-next-line @typescript-eslint/ban-ts-comment
//@ts-ignore
const mockContext: PageJS.Context = {
    save: vi.fn(),
    pushState: vi.fn(),
    handled: false,
    canonicalPath: "",
    path: "",
    querystring: "",
    hash: "",
    pathname: "",
    state: {},
    title: "",
    params: {},
};

function resizeTo(w: number, h: number) {
    (window.innerWidth as number) = w;
    (window.innerHeight as number) = h;
    window.dispatchEvent(new Event("resize"));
}

function initialiseWindowDimensions(w: number, h: number) {
    Object.defineProperty(window, "innerWidth", {
        writable: true,
        configurable: true,
        value: w,
    });

    Object.defineProperty(window, "innerHeight", {
        writable: true,
        configurable: true,
        value: h,
    });
}

describe("ui state", () => {
    beforeAll(() => initialiseWindowDimensions(1024, 768));
    afterEach(() => {
        ui.rightPanelHistory = [];
        resizeTo(1024, 768);
    });

    describe("layout", () => {
        beforeEach(() => {
            pathState.setRouteParams(mockContext, {
                kind: "home_route",
                scope: { kind: "group_chat" },
            });
        });

        describe("desktop width", () => {
            test("show right - full width", () => {
                expect(ui.rightPanelMode).toEqual("hidden");
                resizeTo(2000, 768);
                expect(ui.rightPanelMode).toEqual("inline");
            });

            test("show right - history", () => {
                ui.pushRightPanelHistory({ kind: "group_details" });
                expect(ui.rightPanelMode).toEqual("floating");
                resizeTo(2000, 768);
                expect(ui.rightPanelMode).toEqual("inline");
            });

            test("show middle", () => {
                expect(ui.showMiddle).toBe(true);
            });

            test("show left", () => {
                expect(ui.showLeft).toBe(true);
                pathState.setRouteParams(mockContext, {
                    kind: "communities_route",
                    scope: { kind: "none" },
                });
                expect(ui.showLeft).toBe(false);
                pathState.setRouteParams(mockContext, {
                    kind: "admin_route",
                    scope: { kind: "none" },
                });
                expect(ui.showLeft).toBe(false);
            });
        });

        describe("mobile width", () => {
            beforeEach(() => {
                resizeTo(600, 600);
            });

            test("show right", () => {
                ui.pushRightPanelHistory({ kind: "show_group_members" });
                expect(ui.rightPanelMode).toEqual("inline");
                ui.popRightPanelHistory();
                expect(ui.rightPanelMode).toEqual("hidden");
            });

            test("show middle", () => {
                expect(ui.showMiddle).toBe(false);
                pathState.setRouteParams(mockContext, {
                    kind: "communities_route",
                    scope: { kind: "none" },
                });
                expect(ui.showMiddle).toBe(true);
                ui.pushRightPanelHistory({ kind: "show_group_members" });
                expect(ui.showMiddle).toBe(false);
            });

            test("show left", () => {
                expect(ui.showLeft).toBe(true);
                ui.pushRightPanelHistory({ kind: "show_group_members" });
                expect(ui.showLeft).toBe(false);
            });

            test("show nav", () => {
                expect(ui.showNav).toBe(true);
                ui.pushRightPanelHistory({ kind: "show_group_members" });
                expect(ui.showNav).toBe(false);
                ui.popRightPanelHistory();
                pathState.setRouteParams(mockContext, {
                    kind: "communities_route",
                    scope: { kind: "none" },
                });
                expect(ui.showNav).toBe(true);
            });
        });
    });

    describe("right panel history", () => {
        test("empty", () => {
            expect(ui.rightPanelHistory.length).toBe(0);
        });

        test("push", () => {
            ui.pushRightPanelHistory({ kind: "show_pinned" });
            expect(ui.rightPanelHistory.length).toBe(1);
            expect(ui.rightPanelContains("show_pinned")).toBe(true);
            expect(ui.rightPanelContains("no_panel")).toBe(false);
        });

        test("pop", () => {
            ui.pushRightPanelHistory({ kind: "show_pinned" });
            ui.pushRightPanelHistory({ kind: "community_details" });
            ui.pushRightPanelHistory({ kind: "group_details" });
            expect(ui.rightPanelHistory.length).toBe(3);
            expect(ui.lastRightPanelState.kind).toEqual("group_details");
            ui.popRightPanelHistory();
            expect(ui.lastRightPanelState.kind).toEqual("community_details");
        });
    });
    describe("dimensions based runes", () => {
        test("dimensions", () => {
            expect(ui.dimensions.height).toEqual(768);
            expect(ui.dimensions.width).toEqual(1024);

            resizeTo(800, 600);

            expect(ui.dimensions.height).toEqual(600);
            expect(ui.dimensions.width).toEqual(800);
        });

        test("screenWidth", () => {
            expect(ui.screenWidth).toEqual(ScreenWidth.Large);
            resizeTo(750, 600);
            expect(ui.screenWidth).toEqual(ScreenWidth.Small);
        });

        test("full width", () => {
            expect(ui.fullWidth).toBe(false);
            resizeTo(1800, 800);
            expect(ui.fullWidth).toBe(true);
        });

        test("mobile width", () => {
            expect(ui.mobileWidth).toBe(false);
            resizeTo(767, 800);
            expect(ui.mobileWidth).toBe(true);
        });
    });
});
