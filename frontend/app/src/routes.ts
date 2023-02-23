import { wrap } from "svelte-spa-router/wrap";
import Home from "./components/home/HomeRoute.svelte";
import LandingPage from "./components/landingpages/LandingPage.svelte";
import NotFound from "./components/NotFound.svelte";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function routes(logout: () => Promise<void>): any {
    return {
        "/home": LandingPage,
        "/features": LandingPage,
        "/roadmap": LandingPage,
        "/blog": LandingPage,
        "/blog/*": LandingPage,
        "/whitepaper": LandingPage,
        "/architecture": LandingPage,
        "/:chatId?/:messageIndex?/:threadMessageIndex?": wrap({
            component: Home,
            props: {
                logout,
            },
        }),
        "*": NotFound,
    };
}
