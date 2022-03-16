import Home from "./components/home/HomeRoute.svelte";
import NotFound from "./components/NotFound.svelte";

/**
 * "/" home
 * "/[group|direct]/:chatId/:msgIndex?" [group|direct] chat
 * "/group/:chatId/details" group details
 * "/group/:chatId/members" group members
 * "/group/:chatId/add-members" group members
 * "/hot" recommended groups
 *
 * Some things feel more like route modifiers
 * ===========================================
 * "/user" user profile (implies you cannot have user profile open *and* a chat)
 * "/faq" faq - exclusive with other routes
 * "/roadmap" roadmap - exclusive with other routes
 * "/about" about open chat
 */

// urgh - if we have separate routes that use the same component, the component will get destroyed and recreated when switching between these routes
export const routes = {
    "/recommended": Home,
    "/:chatId?/:messageIndex?": Home,
    "*": NotFound,
};
