import {
    type MemberRole,
    type PermissionRole,
    ROLE_ADMIN,
    ROLE_MEMBER,
    ROLE_MODERATOR,
    ROLE_NONE,
    ROLE_OWNER,
} from "openchat-shared";

export function hasOwnerRights(role: MemberRole): boolean {
    return role === ROLE_OWNER;
}

export function isPermitted(role: MemberRole, permissionRole: PermissionRole): boolean {
    if (role === ROLE_NONE) return false;
    return role >= permissionRole;
}

export function roleAsText(role: MemberRole): string {
    switch (role) {
        case ROLE_OWNER:
            return "owner";

        case ROLE_ADMIN:
            return "admin";

        case ROLE_MODERATOR:
            return "moderator";

        case ROLE_MEMBER:
            return "member";

        default:
            return "none";
    }
}
