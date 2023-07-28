// a module for feature flag constants

import { createLsBoolStore } from "openchat-client";

export const communitiesEnabled = createLsBoolStore("openchat_communities_enabled", true);
