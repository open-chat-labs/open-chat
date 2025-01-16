import { isTouchDevice, mobileOperatingSystem } from "../utils/devices";
import { configKeys } from "../utils/config";
import { createLsBoolStore } from "openchat-client";

export type LsBoolStore = ReturnType<typeof createLsBoolStore>;

export const showHomeScreenPrompt = createLsBoolStore(
    configKeys.showHomeScreenPrompt,
    mobileOperatingSystem === "iOS",
);
export const chitPopup = createLsBoolStore(configKeys.chitPopup, true);
export const hideChitIcon = createLsBoolStore(configKeys.hideChitIcon, false);
export const enterSend = createLsBoolStore(configKeys.enterSend, !isTouchDevice);
export const lowBandwidth = createLsBoolStore(configKeys.lowBandwidth, false);
export const renderPreviews = createLsBoolStore(configKeys.renderPreviews, true);
export const utcMode = createLsBoolStore(configKeys.utcMode, false);
export const videoCameraOn = createLsBoolStore(configKeys.videoCameraOn, true);
export const videoMicOn = createLsBoolStore(configKeys.videoMicOn, true);
export const videoSpeakerView = createLsBoolStore(configKeys.videoSpeakerView, false);
export const dclickReply = createLsBoolStore(configKeys.dclickReply, true);
export const userInfoOpen = createLsBoolStore(configKeys.userInfoSection, true);
export const appearanceSectionOpen = createLsBoolStore(configKeys.appearanceSection, false);
export const chatsSectionOpen = createLsBoolStore(configKeys.chatsSection, false);
export const restrictedSectionOpen = createLsBoolStore(configKeys.restrictedSection, false);
export const videoSectionOpen = createLsBoolStore(configKeys.videoSection, false);
export const referralOpen = createLsBoolStore(configKeys.referralSection, false);
export const storageSectionOpen = createLsBoolStore(configKeys.storageSection, false);
export const verificationSectionOpen = createLsBoolStore(configKeys.verificationSectionOpen, false);
export const accountsSectionOpen = createLsBoolStore(configKeys.verificationSectionOpen, false);
export const statsSectionOpen = createLsBoolStore(configKeys.userStatsSection, false);
export const advancedSectionOpen = createLsBoolStore(configKeys.userAdvancedSection, false);
export const deleteAccountSectionOpen = createLsBoolStore(
    configKeys.userDeleteAccountSection,
    false,
);
export const groupInfoOpen = createLsBoolStore(configKeys.groupInfoSection, true);
export const groupVisibilityOpen = createLsBoolStore(configKeys.groupVisibilitySection, true);
export const groupRulesOpen = createLsBoolStore(configKeys.groupRulesSection, true);
export const groupPermissionsOpen = createLsBoolStore(configKeys.groupPermissionSection, false);
export const groupStatsOpen = createLsBoolStore(configKeys.groupStatsSection, false);
export const groupInviteUsersOpen = createLsBoolStore(configKeys.groupInviteUsersSections, false);
export const groupAdvancedOpen = createLsBoolStore(configKeys.groupAdvancedSection, false);
export const exploreGroupsDismissed = createLsBoolStore(configKeys.exploreGroupsDismissed, false);
export const browseChannels = createLsBoolStore(configKeys.browseChannels, true);
export const useBlockLevelMarkdown = createLsBoolStore(configKeys.useBlockLevelMarkdown, false);

export const communityVisibilityOpen = createLsBoolStore(
    configKeys.communityVisibilitySection,
    true,
);
export const communityRulesOpen = createLsBoolStore(configKeys.communityRulesSection, true);
export const communityPermissionsOpen = createLsBoolStore(
    configKeys.communityPermissionSection,
    false,
);
export const communityStatsOpen = createLsBoolStore(configKeys.communityStatsSection, false);
export const communityAdvancedOpen = createLsBoolStore(configKeys.communityAdvancedSection, false);
export const communityInviteUsersOpen = createLsBoolStore(
    configKeys.communityInviteUsersSections,
    false,
);
export const referredUsersOpen = createLsBoolStore(configKeys.referredUsersOpen, false);
