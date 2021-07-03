import Home from "./components/Home.svelte";
import NotFound from "./components/NotFound.svelte";

export const routes = {
    "/:chatId?": Home,
    "*": NotFound,
};
