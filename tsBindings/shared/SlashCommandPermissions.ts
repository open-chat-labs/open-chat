// This file was generated by [ts-rs](https://github.com/Aleph-Alpha/ts-rs). Do not edit this file manually.
import type { CommunityPermission } from "./CommunityPermission";
import type { GroupPermission } from "./GroupPermission";
import type { MessagePermission } from "./MessagePermission";

export type ExternalBotPermissions = {
  community: Array<CommunityPermission>;
  chat: Array<GroupPermission>;
  message: Array<MessagePermission>;
};
