import { logout } from "./services/auth";
import { wrap } from "svelte-spa-router/wrap";
import Home from "./components/home/HomeRoute.svelte";
import NotFound from "./components/NotFound.svelte";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function routes(): any {
    return {
        "/:chatId?/:messageIndex?/:threadMessageIndex?": wrap({
            component: Home,
            props: {
                logout,
            },
        }),
        "*": NotFound,
    };
}
