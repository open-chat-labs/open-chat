// a module for feature flag constants

import { createLsBoolStore } from "openchat-client";

export const gatedGroupsEnabled = true;
export const remindersEnabled = true;
export const reportMessageEnabled = true;
export const communitiesEnabled = createLsBoolStore("openchat_communities_enabled", false);
