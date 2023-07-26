/* eslint-disable @typescript-eslint/no-var-requires */
/* eslint-disable no-undef */
const { Translate } = require("@google-cloud/translate").v2;
const { merge, chunk } = require("lodash");
const fs = require("fs");
require("dotenv").config();

const translate = new Translate({
    key: process.env.TRANSLATE_API_KEY,
});

async function generateLanguage(lang, code) {
    // script to create a started language file for open chat using google translate to translate the en.json file
    const target = lang;
    const targetLang = code;

    const tokensByKey = {};

    console.log("Translating: ", lang, code);

    const enData = JSON.parse(fs.readFileSync("./src/i18n/en.json"));
    let targetData = {};
    try {
        targetData = JSON.parse(fs.readFileSync(`./src/i18n/${target}.json`));
    } catch (err) {
        console.log(`No file found for ${target} - generating a new one`);
    }

    function missingEntries(enEntries, targetEntries) {
        // if we need to delete a bunch of keys from all languages (for example if the english key has changed), add all the keys to this set
        const toDelete = new Set([
            // "confirmMakeGroupPrivate",
            // "makeGroupPrivateFailed",
            // "groupVisibilityChangedBy",
            // "confirmLeaveGroup",
            // "userJoined",
            // "addedBy",
            // "removedBy",
            // "invitedBy",
            // "permissionsChangedBy",
            // "failedToLeaveGroup",
            // "nUsersJoined",
            // "ownerCantLeave",
            "permissions.removeMembers"
        ]);
        const missing = [];
        enEntries.forEach(([k, v]) => {
            if (targetEntries.find(([tk]) => tk === k) === undefined || toDelete.has(k)) {
                const cleaned = v.replace(/{[^}.]*}/g, (match) => {
                    if (tokensByKey[k] === undefined) {
                        tokensByKey[k] = [];
                    }
                    tokensByKey[k].push(match);
                    return "{xyz}";
                });

                missing.push([k, cleaned]);
            }
        });
        return missing;
    }

    async function translateText() {
        const enEntries = Object.entries(flatten(enData));
        const targetEntries = Object.entries(flatten(targetData));
        const missing = missingEntries(enEntries, targetEntries);

        const translated = await Promise.all(
            chunk(missing, 50).map(async (chunk) => {
                const translatedChunk = await translateBatch(chunk.map(([, v]) => v));
                const translatedArr = translatedChunk.map((val, i) => {
                    return [chunk[i][0], val];
                });
                return translatedArr.reduce((agg, [k, v]) => {
                    if (tokensByKey[k] !== undefined) {
                        tokensByKey[k].forEach((t) => {
                            v = v.replace("{xyz}", t);
                        });
                    }
                    agg[k] = v;
                    return agg;
                }, {});
            })
        );

        const merged = translated.reduce((agg, chunk) => {
            return {
                ...agg,
                ...chunk,
            };
        }, {});

        const unflattened = unflatten(merged);
        return merge(targetData, unflattened);
    }

    async function translateBatch(values) {
        let [translations] = await translate.translate(values, targetLang);
        return Array.isArray(translations) ? translations : [translations];
    }

    function unflatten(flat) {
        return Object.entries(flat).reduce((agg, [k, v]) => {
            const segments = k.split(".");
            segments.reduce((agg_, segment, i) => {
                if (i == segments.length - 1) {
                    agg_[segment] = v;
                    return agg_;
                } else {
                    if (agg_[segment] === undefined) {
                        agg_[segment] = {};
                    }
                    return agg_[segment];
                }
            }, agg);
            return agg;
        }, {});
    }

    function flatten(map) {
        const flat = {};
        function traverse(map, flat, prefix) {
            Object.keys(map).forEach((k) => {
                const key = prefix ? `${prefix}.${k}` : k;
                if (typeof map[k] === "string") {
                    flat[key] = map[k];
                }
                if (typeof map[k] === "object") {
                    traverse(map[k], flat, key);
                }
            });
        }
        traverse(map, flat);
        return flat;
    }

    await translateText().then((translated) => {
        fs.writeFileSync(`./src/i18n/${target}.json`, JSON.stringify(translated, null, 4));
    });
}

const languages = [
    { lang: "cn", code: "zh-cn" },
    { lang: "de", code: "de" },
    { lang: "es", code: "es" },
    { lang: "fr", code: "fr" },
    { lang: "it", code: "it" },
    { lang: "jp", code: "ja" },
    { lang: "ru", code: "ru" },
    { lang: "vi", code: "vi" },
    { lang: "iw", code: "iw" },
];

languages.forEach(async ({ lang, code }) => {
    await generateLanguage(lang, code);
});
