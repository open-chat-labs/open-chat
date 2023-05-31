export const allRoles = ["owner", "admins", "moderators", "members"] as const;
export const groupRoles = allRoles;
type GroupRolesType = typeof allRoles;
export type GroupPermissionRole = GroupRolesType[number];
export type PermissionRole = GroupPermissionRole;

export const communityRoles = ["owner", "admins", "members"] as const;
type CommunityRolesType = typeof communityRoles;
export type CommunityPermissionRole = CommunityRolesType[number];

export type MemberRole = "admin" | "moderator" | "participant" | "owner" | "previewer";

export type Permissioned<T> = {
    permissions: T;
    myRole: MemberRole;
};
