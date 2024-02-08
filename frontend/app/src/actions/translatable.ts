/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/explicit-module-boundary-types */
import { locale, dictionary } from "svelte-i18n";
import { editmode, editingLabel, type ResourceKey } from "../i18n/i18n";
import { derived, get } from "svelte/store";
import { currentTheme } from "../theme/themes";
import type { Theme } from "../theme/types";

interface LocaleDictionary {
    [key: string]: LocaleDictionary | string | Array<string | LocaleDictionary> | null;
}
type LocalesDictionary = {
    [key: string]: LocaleDictionary | null;
};

function getSvg(theme: Theme) {
    return `
        <?xml version="1.0" encoding="utf-8"?>
        <svg width="16px" height="16px" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
        <g transform="matrix(0.909091, 0, 0, 1, 1, 0)" style="transform-origin: 1px 2px;">
            <path fill="${theme.accent}" d="M12.87 15.07l-2.54-2.51.03-.03c1.74-1.94 2.98-4.17 3.71-6.53H17V4h-7V2H8v2H1v1.99h11.17C11.5 7.92 10.44 9.75 9 11.35 8.07 10.32 7.3 9.19 6.69 8h-2c.73 1.63 1.73 3.17 2.98 4.56l-5.09 5.02L4 19l5-5 3.11 3.11.76-2.04zM18.5 10h-2L12 22h2l1.12-3h4.75L21 22h2l-4.5-12zm-2.62 7l1.62-4.33L19.12 17h-3.24z"/>
        </g>
        </svg>
    `;
}

function isTranslatable(
    dictionary: LocalesDictionary,
    locale: string | null | undefined,
    { key }: ResourceKey,
): boolean {
    if (!locale) return false;
    const localeValues = dictionary[locale];

    if (!localeValues) return false;

    if (key in localeValues) return true;

    const keys = key.split(".");
    let result: any = localeValues;

    for (const key of keys) {
        const val = result[key];
        if (val == null) {
            return false;
        } else {
            result = val;
        }
    }
    return result !== undefined;
}

type Param = {
    key: ResourceKey | undefined;
    position?: "relative" | "absolute";
    top?: number;
    right?: number;
};

export function translatable(node: HTMLElement, param: Param) {
    if (param.key === undefined) return;
    let resourceKey = param.key;
    const position = param.position ?? "relative";
    const top = param.top ?? 4;
    const right = param.right;

    // this will be called if the parameter changes on this node
    const update = (param: Param) => {
        if (param.key !== undefined) {
            resourceKey = param.key;
        }
    };

    const editable = derived(
        [locale, dictionary, editmode],
        ([$locale, $dictionary, $editmode]) => {
            return (
                $editmode &&
                !$locale?.startsWith("en") &&
                isTranslatable($dictionary, $locale, resourceKey)
            );
        },
    );
    let span: HTMLSpanElement | undefined = undefined;
    const unsub = editable.subscribe((canEdit) => {
        if (canEdit) {
            span = document.createElement("span");
            span.classList.add("is-translatable");
            span.style.position = position;
            span.style.top = `${top}px`;
            if (right !== undefined) {
                span.style.right = `${right}px`;
            }
            span.innerHTML = getSvg(get(currentTheme));
            node.parentNode?.insertBefore(span, node.nextSibling);
            span.addEventListener("click", (ev) => {
                ev.stopPropagation();
                editingLabel.set(resourceKey);
            });
        } else {
            if (span) {
                node.parentNode?.removeChild(span);
            }
        }
    });

    const destroy = unsub;

    return {
        destroy,
        update,
    };
}
