import Home from "./components/Home.svelte";
import NotFound from "./components/NotFound.svelte";

export const routes = {
    "/": Home,
    "/chat/:chatId": Home,
    "*": NotFound,
};
