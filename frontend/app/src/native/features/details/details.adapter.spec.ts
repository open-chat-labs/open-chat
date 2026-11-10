import { ROLE_ADMIN, ROLE_MEMBER, ROLE_MODERATOR, ROLE_NONE, ROLE_OWNER } from "@client";
import { DISAPPEARING_DURATIONS } from "@src/logic/chats/disappearingMessages";
import { IntlMessageFormat } from "intl-messageformat";
import { describe, expect, test } from "vitest";
import ar from "../../../i18n/ar.json";
import cn from "../../../i18n/cn.json";
import de from "../../../i18n/de.json";
import en from "../../../i18n/en.json";
import es from "../../../i18n/es.json";
import fa from "../../../i18n/fa.json";
import fr from "../../../i18n/fr.json";
import hi from "../../../i18n/hi.json";
import it from "../../../i18n/it.json";
import iw from "../../../i18n/iw.json";
import jp from "../../../i18n/jp.json";
import pl from "../../../i18n/pl.json";
import ru from "../../../i18n/ru.json";
import uk from "../../../i18n/uk.json";
import vi from "../../../i18n/vi.json";
import {
    createdFacts,
    disappearAfterLabel,
    disappearingValue,
    dmTiles,
    durationLabel,
    groupTiles,
    historyValue,
    manageRows,
    memberMenuItems,
    menuItemRole,
    roleWord,
    searchOnCover,
    showsManage,
} from "./details.adapter";

const t = (key: string, values?: Record<string, string | number>) =>
    values === undefined ? key : `${key}(${Object.values(values).join(",")})`;

describe("the tiles", () => {
    test("are a DM's Call / Search / Mute", () => {
        const tiles = dmTiles({ canCall: true, muted: false, isBot: false }, t);
        expect(tiles.map((x) => x.id)).toEqual(["call", "search", "mute"]);
        expect(tiles[2]).toMatchObject({ label: "native.details.tiles.mute", on: false });
    });

    test("leave out Call where calls can't start, and Mute for a bot", () => {
        expect(dmTiles({ canCall: false, muted: false, isBot: true }, t).map((x) => x.id)).toEqual([
            "search",
        ]);
    });

    test("put a lone Search on the cover (a bot's DM), not in a row of one", () => {
        expect(searchOnCover(dmTiles({ canCall: false, muted: false, isBot: true }, t))).toBe(true);
        expect(searchOnCover(dmTiles({ canCall: false, muted: false, isBot: false }, t))).toBe(
            false,
        );
        expect(searchOnCover(groupTiles({ canInvite: false, muted: false }, t))).toBe(false);
    });

    test("show a muted chat's Mute as on, offering Unmute", () => {
        expect(dmTiles({ canCall: false, muted: true, isBot: false }, t)[1]).toMatchObject({
            id: "mute",
            label: "native.details.tiles.unmute",
            on: true,
        });
    });

    test("are a group's Mute / Search / Invite, Invite only for someone who can invite", () => {
        expect(groupTiles({ canInvite: true, muted: false }, t).map((x) => x.id)).toEqual([
            "mute",
            "search",
            "invite",
        ]);
        expect(groupTiles({ canInvite: false, muted: false }, t).map((x) => x.id)).toEqual([
            "mute",
            "search",
        ]);
    });
});

describe("Manage", () => {
    test("is for owners and admins only", () => {
        expect(showsManage(ROLE_OWNER, false)).toBe(true);
        expect(showsManage(ROLE_ADMIN, false)).toBe(true);
        expect(showsManage(ROLE_MODERATOR, false)).toBe(false);
        expect(showsManage(ROLE_MEMBER, false)).toBe(false);
        expect(showsManage(ROLE_NONE, false)).toBe(false);
    });

    test("isn't offered in a frozen chat", () => {
        expect(showsManage(ROLE_OWNER, true)).toBe(false);
    });

    test("lists the settings pages in the design's order", () => {
        expect(manageRows(t).map((r) => r.page)).toEqual([
            "gates",
            "rules",
            "permissions",
            "bots",
            "stats",
        ]);
    });
});

describe("values", () => {
    test("say a duration in the app's words", () => {
        expect(durationLabel("8 hours", t)).toBe("native.details.duration.hour(8)");
        expect(durationLabel("1 week", t)).toBe("native.details.duration.week(1)");
    });

    test("say how long disappearing messages last, in a phrase of the unit's own", () => {
        expect(disappearAfterLabel("8 hours", t)).toBe("native.details.disappearAfter.hour(8)");
        expect(disappearAfterLabel("30 days", t)).toBe("native.details.disappearAfter.day(30)");
        expect(disappearAfterLabel("forever", t)).toBe("forever");
    });

    test("say a group's disappearing messages are off, or how long they last", () => {
        expect(disappearingValue(undefined, t)).toBe("native.you.off");
        expect(disappearingValue(BigInt(86_400_000), t)).toBe("native.details.duration.day(1)");
    });

    test("say whether new members see the history", () => {
        expect(historyValue(true, t)).toBe("native.details.historyVisible");
        expect(historyValue(false, t)).toBe("native.details.historyHidden");
    });
});

describe("when a group was created", () => {
    const created = { timestamp: BigInt(Date.UTC(2026, 10, 10, 12)), createdBy: "u1" };

    test("says nothing until it's read, nor where it can't be", () => {
        expect(createdFacts(undefined, undefined, "en", t)).toEqual([]);
        expect(createdFacts(undefined, "owner", "en", t)).toEqual([]);
    });

    test("is the day it was made, and who made it once their name is in", () => {
        expect(createdFacts(created, undefined, "en", t)).toEqual([
            { label: "native.details.created", value: "Nov 10, 2026" },
        ]);
        expect(createdFacts(created, "ann", "en", t)).toEqual([
            { label: "native.details.created", value: "Nov 10, 2026" },
            { label: "native.details.createdBy", value: "@ann" },
        ]);
    });
});

describe("a member's ⋯", () => {
    test("lists the roles, then Remove and Block after a divider", () => {
        const items = memberMenuItems(
            { kind: "actions", roles: [ROLE_OWNER, ROLE_MEMBER], remove: true, block: true },
            t,
        );
        expect(items.map((i) => i.id)).toEqual([`role:${ROLE_OWNER}`, `role:${ROLE_MEMBER}`, "remove", "block"]);
        expect(items.map((i) => i.label)).toEqual([
            "native.details.members.make.owner",
            "native.details.members.make.member",
            "native.details.members.remove",
            "native.details.members.block",
        ]);
        expect(items[2]).toMatchObject({ danger: true, separator: true });
        expect(items[3].separator).toBeUndefined();
    });

    test("has no divider with only Remove and Block", () => {
        const items = memberMenuItems({ kind: "actions", roles: [], remove: true, block: false }, t);
        expect(items).toEqual([
            { id: "remove", label: "native.details.members.remove", icon: "user-minus", danger: true },
        ]);
    });

    test("gives the role its item names", () => {
        expect(menuItemRole(`role:${ROLE_ADMIN}`)).toBe(ROLE_ADMIN);
        expect(menuItemRole("remove")).toBeUndefined();
        expect(menuItemRole("role:9")).toBeUndefined();
    });

    test("names a role by its word", () => {
        expect(roleWord(ROLE_MODERATOR)).toBe("moderator");
        expect(roleWord(ROLE_NONE)).toBe("member");
    });
});

// the review of 2026-11-10: "After {value}" around a length in its own case read "Nach 30 Tage"
// and "Po 1 dzień"; the preposition sets the case, so each unit has its own phrase
describe("the disappearing row's subtitle in each language", () => {
    const locales = { ar, cn, de, en, es, fa, fr, hi, it, iw, jp, pl, ru, uk, vi };
    type Locale = (typeof locales)[keyof typeof locales];
    const translate =
        (lang: string, locale: Locale) =>
        (key: string, values?: Record<string, string | number>): string => {
            const units: Record<string, string> = locale.native.details.disappearAfter;
            const message = units[key.replace("native.details.disappearAfter.", "")];
            if (message === undefined) throw new Error(`${lang}: no ${key}`);
            return String(new IntlMessageFormat(message, lang).format(values));
        };
    const say = (lang: keyof typeof locales, id: string) =>
        disappearAfterLabel(id, translate(lang, locales[lang]));

    test("every language says every length", () => {
        for (const [lang, locale] of Object.entries(locales)) {
            for (const id of [...DISAPPEARING_DURATIONS, "2 days", "2 weeks", "1 minute"]) {
                expect(disappearAfterLabel(id, translate(lang, locale))).toMatch(/\d|\p{L}/u);
            }
        }
    });

    test("the length takes the case its preposition asks for", () => {
        expect(say("en", "8 hours")).toBe("After 8 hours");
        expect(say("de", "30 days")).toBe("Nach 30 Tagen");
        expect(say("de", "1 day")).toBe("Nach 1 Tag");
        expect(say("pl", "1 day")).toBe("Po 1 dniu");
        expect(say("pl", "1 week")).toBe("Po 1 tygodniu");
        expect(say("pl", "30 days")).toBe("Po 30 dniach");
        expect(say("ru", "1 week")).toBe("Через 1 неделю");
        expect(say("uk", "1 hour")).toBe("Через 1 годину");
        expect(say("hi", "1 hour")).toBe("1 घंटे बाद");
        expect(say("ar", "2 days")).toBe("بعد يومين");
    });
});
