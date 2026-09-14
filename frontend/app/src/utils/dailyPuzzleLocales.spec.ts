import { describe, expect, test } from "vitest";
import ar from "../i18n/ar.json";
import cn from "../i18n/cn.json";
import de from "../i18n/de.json";
import en from "../i18n/en.json";
import es from "../i18n/es.json";
import fa from "../i18n/fa.json";
import fr from "../i18n/fr.json";
import hi from "../i18n/hi.json";
import it from "../i18n/it.json";
import iw from "../i18n/iw.json";
import jp from "../i18n/jp.json";
import pl from "../i18n/pl.json";
import ru from "../i18n/ru.json";
import uk from "../i18n/uk.json";
import vi from "../i18n/vi.json";

// Every locale the app ships (frontend/app/src/i18n/*.json) other than English
const locales: Record<string, unknown> = { ar, cn, de, es, fa, fr, hi, it, iw, jp, pl, ru, uk, vi };

type Tree = { [key: string]: string | Tree };

function flatten(tree: Tree | undefined, prefix = ""): Map<string, string> {
    const out = new Map<string, string>();
    for (const [k, v] of Object.entries(tree ?? {})) {
        const key = prefix === "" ? k : `${prefix}.${k}`;
        if (typeof v === "string") out.set(key, v);
        else for (const [ik, iv] of flatten(v, key)) out.set(ik, iv);
    }
    return out;
}

function placeholders(s: string): string[] {
    return [...s.matchAll(/\{[a-zA-Z]+\}/g)].map((m) => m[0]).sort();
}

const english = flatten(en.dailyPuzzle as Tree);

// #9362: the daily puzzle reads in the player's language like the rest of the app
describe("daily puzzle locales (#9362)", () => {
    for (const [code, tree] of Object.entries(locales)) {
        const local = flatten((tree as { dailyPuzzle?: Tree }).dailyPuzzle);

        // invariant 1
        test(`${code} has every dailyPuzzle key en.json has`, () => {
            const missing = [...english.keys()].filter((k) => !local.has(k));
            expect(missing).toEqual([]);
        });

        // invariant 2
        test(`${code} keeps every placeholder of every dailyPuzzle string`, () => {
            const broken = [...english].filter(
                ([k, v]) =>
                    local.has(k) && placeholders(local.get(k)!).join() !== placeholders(v).join(),
            );
            expect(broken.map(([k]) => k)).toEqual([]);
        });

        // invariant 3
        test(`${code} technique sentences are translated, not copied`, () => {
            const copied = [...english].filter(
                ([k, v]) => k.includes(".technique.") && local.get(k) === v,
            );
            expect(copied.map(([k]) => k)).toEqual([]);
        });
    }
});
