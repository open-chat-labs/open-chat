import { wrap } from "svelte-spa-router/wrap";
import Home from "./components/home/HomeRoute.svelte";
import NotFound from "./components/NotFound.svelte";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function routes(logout: () => void): any {
    return {
        "/:chatId?/:messageIndex?": wrap({
            component: Home,
            props: {
                logout,
            },
        }),
        "*": NotFound,
    };
}
