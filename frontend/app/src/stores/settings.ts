import { LocalStorageBoolStore } from "openchat-client/lib/state/localStorageStore";
import { configKeys } from "../utils/config";
import { isTouchDevice, mobileOperatingSystem } from "../utils/devices";

export const showHomeScreenPrompt = new LocalStorageBoolStore(
    configKeys.showHomeScreenPrompt,
    mobileOperatingSystem === "iOS",
);
export const chitPopup = new LocalStorageBoolStore(configKeys.chitPopup, true);
export const hideChitIcon = new LocalStorageBoolStore(configKeys.hideChitIcon, false);
export const disableChit = new LocalStorageBoolStore(configKeys.disableChit, false);
export const enterSend = new LocalStorageBoolStore(configKeys.enterSend, !isTouchDevice);
export const lowBandwidth = new LocalStorageBoolStore(configKeys.lowBandwidth, false);
export const renderPreviews = new LocalStorageBoolStore(configKeys.renderPreviews, true);
export const utcMode = new LocalStorageBoolStore(configKeys.utcMode, false);
export const videoCameraOn = new LocalStorageBoolStore(configKeys.videoCameraOn, true);
export const videoMicOn = new LocalStorageBoolStore(configKeys.videoMicOn, true);
export const videoSpeakerView = new LocalStorageBoolStore(configKeys.videoSpeakerView, false);
export const dclickReply = new LocalStorageBoolStore(configKeys.dclickReply, true);
export const userInfoOpen = new LocalStorageBoolStore(configKeys.userInfoSection, true);
export const appearanceSectionOpen = new LocalStorageBoolStore(configKeys.appearanceSection, false);
export const chatsSectionOpen = new LocalStorageBoolStore(configKeys.chatsSection, false);
export const restrictedSectionOpen = new LocalStorageBoolStore(configKeys.restrictedSection, false);
export const videoSectionOpen = new LocalStorageBoolStore(configKeys.videoSection, false);
export const referralOpen = new LocalStorageBoolStore(configKeys.referralSection, false);
export const storageSectionOpen = new LocalStorageBoolStore(configKeys.storageSection, false);
export const verificationSectionOpen = new LocalStorageBoolStore(
    configKeys.verificationSectionOpen,
    false,
);
export const accountsSectionOpen = new LocalStorageBoolStore(
    configKeys.verificationSectionOpen,
    false,
);
export const statsSectionOpen = new LocalStorageBoolStore(configKeys.userStatsSection, false);
export const advancedSectionOpen = new LocalStorageBoolStore(configKeys.userAdvancedSection, false);
export const deleteAccountSectionOpen = new LocalStorageBoolStore(
    configKeys.userDeleteAccountSection,
    false,
);
export const groupInfoOpen = new LocalStorageBoolStore(configKeys.groupInfoSection, true);
export const groupVisibilityOpen = new LocalStorageBoolStore(
    configKeys.groupVisibilitySection,
    true,
);
export const groupRulesOpen = new LocalStorageBoolStore(configKeys.groupRulesSection, true);
export const groupPermissionsOpen = new LocalStorageBoolStore(
    configKeys.groupPermissionSection,
    false,
);
export const groupStatsOpen = new LocalStorageBoolStore(configKeys.groupStatsSection, false);
export const groupInviteUsersOpen = new LocalStorageBoolStore(
    configKeys.groupInviteUsersSections,
    false,
);
export const groupAdvancedOpen = new LocalStorageBoolStore(configKeys.groupAdvancedSection, false);
export const exploreGroupsDismissed = new LocalStorageBoolStore(
    configKeys.exploreGroupsDismissed,
    false,
);
export const browseChannels = new LocalStorageBoolStore(configKeys.browseChannels, true);
export const useBlockLevelMarkdown = new LocalStorageBoolStore(
    configKeys.useBlockLevelMarkdown,
    false,
);
export const hideTokenBalances = new LocalStorageBoolStore(configKeys.hideChitIcon, false);

export const communityVisibilityOpen = new LocalStorageBoolStore(
    configKeys.communityVisibilitySection,
    true,
);
export const communityRulesOpen = new LocalStorageBoolStore(configKeys.communityRulesSection, true);
export const communityPermissionsOpen = new LocalStorageBoolStore(
    configKeys.communityPermissionSection,
    false,
);
export const communityStatsOpen = new LocalStorageBoolStore(
    configKeys.communityStatsSection,
    false,
);
export const communityAdvancedOpen = new LocalStorageBoolStore(
    configKeys.communityAdvancedSection,
    false,
);
export const communityInviteUsersOpen = new LocalStorageBoolStore(
    configKeys.communityInviteUsersSections,
    false,
);
export const referredUsersOpen = new LocalStorageBoolStore(configKeys.referredUsersOpen, false);
export const linkDeviceSectionOpen = new LocalStorageBoolStore(configKeys.linkDeviceSection, false);
