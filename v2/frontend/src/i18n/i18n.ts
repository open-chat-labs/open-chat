import { init, getLocaleFromNavigator, addMessages } from "svelte-i18n";

import en from "./en.json";
import ar from "./ar.json";
import fr from "./fr.json";

// todo we should be loading these async on demand
addMessages("en", en);
addMessages("ar", ar);
addMessages("fr", fr);

init({
    fallbackLocale: "en",
    initialLocale: getLocaleFromNavigator(),
});
