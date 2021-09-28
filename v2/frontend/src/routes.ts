import Home from "./components/home/HomeRoute.svelte";
import NotFound from "./components/NotFound.svelte";

export const routes = {
    "/:chatId?/:eventIndex?": Home,
    "*": NotFound,
};
