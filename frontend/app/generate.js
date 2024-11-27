/* eslint-disable @typescript-eslint/no-var-requires */
/* eslint-disable no-undef */
const { Translate } = require("@google-cloud/translate").v2;
const { chunk } = require("lodash");
const fs = require("fs");
const path = require("path");

require("dotenv").config({ path: path.join(__dirname, "../.env") });

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
        const missing = [];
        enEntries.forEach(([k, v]) => {
            if (targetEntries.find(([tk]) => tk === k) === undefined) {
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
        const enMap = flatten(enData);
        const enKeys = Object.keys(enMap);
        const enEntries = Object.entries(enMap);
        const targetMap = flatten(targetData);
        const targetEntries = Object.entries(targetMap);
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
            }),
        );

        const newTranslationsMap = translated.reduce((agg, chunk) => {
            return {
                ...agg,
                ...chunk,
            };
        }, {});

        return unflatten(buildNewTargetEntries(enKeys, targetMap, newTranslationsMap));
    }

    function buildNewTargetEntries(enKeys, targetMap, newTranslationsMap) {
        return enKeys
            .sort((a, b) => a.localeCompare(b))
            .map((k) => [k, targetMap[k] ?? newTranslationsMap[k]]);
    }

    async function translateBatch(values) {
        let [translations] = await translate.translate(values, targetLang);
        return Array.isArray(translations) ? translations : [translations];
    }

    function unflatten(flatEntries) {
        return flatEntries.reduce((agg, [k, v]) => {
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
    { lang: "en", code: "en" },
    { lang: "cn", code: "zh-cn" },
    { lang: "de", code: "de" },
    { lang: "es", code: "es" },
    { lang: "fr", code: "fr" },
    { lang: "hi", code: "hi" },
    { lang: "it", code: "it" },
    { lang: "iw", code: "iw" },
    { lang: "jp", code: "ja" },
    { lang: "ru", code: "ru" },
    { lang: "uk", code: "uk" },
    { lang: "vi", code: "vi" },
    { lang: "pl", code: "pl" },
    { lang: "fa", code: "fa" },
    { lang: "ar", code: "ar" },
];

languages.forEach(async ({ lang, code }) => {
    await generateLanguage(lang, code);
});
