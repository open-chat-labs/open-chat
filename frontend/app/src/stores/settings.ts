import { isTouchDevice } from "../utils/devices";
import { configKeys } from "../utils/config";
import { createLsBoolStore } from "openchat-client";

export type LsBoolStore = ReturnType<typeof createLsBoolStore>;

export const enterSend = createLsBoolStore(configKeys.enterSend, !isTouchDevice);
export const lowBandwidth = createLsBoolStore(configKeys.lowBandwidth, false);
export const userInfoOpen = createLsBoolStore(configKeys.userInfoSection, true);
export const appearanceSectionOpen = createLsBoolStore(configKeys.appearanceSection, false);
export const chatsSectionOpen = createLsBoolStore(configKeys.chatsSection, false);
export const referralOpen = createLsBoolStore(configKeys.referralSection, false);
export const storageSectionOpen = createLsBoolStore(configKeys.storageSection, false);
export const statsSectionOpen = createLsBoolStore(configKeys.userStatsSection, false);
export const advancedSectionOpen = createLsBoolStore(configKeys.userAdvancedSection, false);
export const groupInfoOpen = createLsBoolStore(configKeys.groupInfoSection, true);
export const groupVisibilityOpen = createLsBoolStore(configKeys.groupVisibilitySection, true);
export const groupRulesOpen = createLsBoolStore(configKeys.groupRulesSection, true);
export const groupPermissionsOpen = createLsBoolStore(configKeys.groupPermissionSection, false);
export const groupStatsOpen = createLsBoolStore(configKeys.groupStatsSection, false);
export const groupInviteUsersOpen = createLsBoolStore(configKeys.groupInviteUsersSections, false);
export const groupAdvancedOpen = createLsBoolStore(configKeys.groupAdvancedSection, false);
export const discoverHotGroupsDismissed = createLsBoolStore(
    configKeys.discoverHotGroupsDismissed,
    false
);

export const communityVisibilityOpen = createLsBoolStore(
    configKeys.communityVisibilitySection,
    true
);
export const communityRulesOpen = createLsBoolStore(configKeys.communityRulesSection, true);
export const communityPermissionsOpen = createLsBoolStore(
    configKeys.communityPermissionSection,
    false
);
export const communityStatsOpen = createLsBoolStore(configKeys.communityStatsSection, false);
export const communityAdvancedOpen = createLsBoolStore(configKeys.communityAdvancedSection, false);
export const communityInviteUsersOpen = createLsBoolStore(
    configKeys.communityInviteUsersSections,
    false
);
