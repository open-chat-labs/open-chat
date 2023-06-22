import type { MemberRole, PermissionRole } from "openchat-shared";

export function hasOwnerRights(role: MemberRole): boolean {
    return role === "owner";
}

export function isPermitted(role: MemberRole, permissionRole: PermissionRole): boolean {
    if (role === "none") return false;
    switch (permissionRole) {
        case "owner":
            return hasOwnerRights(role);
        case "admin":
            return role !== "member" && role !== "moderator";
        case "moderator":
            return role !== "member";
        case "member":
            return true;
    }
    return false;
}
