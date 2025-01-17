// This file was generated by [ts-rs](https://github.com/Aleph-Alpha/ts-rs). Do not edit this file manually.
import type { CustomPermission } from "./CustomPermission";
import type { GroupPermissionRole } from "./GroupPermissionRole";
import type { OptionUpdateGroupPermissionRole } from "./OptionUpdateGroupPermissionRole";

export type OptionalMessagePermissions = { default?: GroupPermissionRole | undefined, text: OptionUpdateGroupPermissionRole, image: OptionUpdateGroupPermissionRole, video: OptionUpdateGroupPermissionRole, audio: OptionUpdateGroupPermissionRole, file: OptionUpdateGroupPermissionRole, poll: OptionUpdateGroupPermissionRole, crypto: OptionUpdateGroupPermissionRole, giphy: OptionUpdateGroupPermissionRole, prize: OptionUpdateGroupPermissionRole, p2p_swap: OptionUpdateGroupPermissionRole, video_call: OptionUpdateGroupPermissionRole, custom_updated: Array<CustomPermission>, custom_deleted: Array<string>, };
