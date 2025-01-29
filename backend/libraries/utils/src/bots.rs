use std::cmp::Eq;
use std::collections::HashSet;
use std::hash::Hash;
use types::BotPermissions;

pub fn can_bot_execute_action(required: &BotPermissions, granted: &BotPermissions) -> bool {
    required.community.is_subset(&granted.community)
        && required.chat.is_subset(&granted.chat)
        && required.message.is_subset(&granted.message)
}

pub fn intersect_permissions(p1: &BotPermissions, p2: &BotPermissions) -> BotPermissions {
    fn intersect<T: Hash + Eq + Clone>(x: &HashSet<T>, y: &HashSet<T>) -> HashSet<T> {
        x.intersection(y).cloned().collect()
    }

    BotPermissions {
        community: intersect(&p1.community, &p2.community),
        chat: intersect(&p1.chat, &p2.chat),
        message: intersect(&p1.message, &p2.message),
    }
}

#[cfg(test)]
mod tests {
    use types::{CommunityPermission, GroupPermission, MessagePermission};

    use super::*;

    #[test]
    fn can_execute_remove_community_member_succeeds() {
        let (required, granted_to_bot, granted_to_user) = setup(false, false);
        let granted = intersect_permissions(&granted_to_bot, &granted_to_user);

        assert!(can_bot_execute_action(&required, &granted));
    }

    #[test]
    fn can_execute_remove_community_member_fails_if_bot_missing_permission() {
        let (required, granted_to_bot, granted_to_user) = setup(true, false);
        let granted = intersect_permissions(&granted_to_bot, &granted_to_user);

        assert!(!can_bot_execute_action(&required, &granted));
    }

    #[test]
    fn can_execute_remove_community_member_fails_if_user_missing_permission() {
        let (required, granted_to_bot, granted_to_user) = setup(false, true);
        let granted = intersect_permissions(&granted_to_bot, &granted_to_user);

        assert!(!can_bot_execute_action(&required, &granted));
    }

    fn setup(bot_missing: bool, user_missing: bool) -> (BotPermissions, BotPermissions, BotPermissions) {
        let required = BotPermissions {
            community: HashSet::from_iter([CommunityPermission::RemoveMembers]),
            chat: HashSet::new(),
            message: HashSet::from_iter([MessagePermission::Text]),
        };

        let mut bot_community_permissions = HashSet::from_iter([CommunityPermission::InviteUsers]);
        if !bot_missing {
            bot_community_permissions.insert(CommunityPermission::RemoveMembers);
        }
        let granted_to_bot = BotPermissions {
            community: bot_community_permissions,
            chat: HashSet::from_iter([GroupPermission::RemoveMembers]),
            message: HashSet::from_iter([MessagePermission::Text, MessagePermission::Image]),
        };

        let mut user_community_permissions = HashSet::from_iter([CommunityPermission::ManageUserGroups]);
        if !user_missing {
            user_community_permissions.insert(CommunityPermission::RemoveMembers);
        }
        let granted_to_user = BotPermissions {
            community: user_community_permissions,
            chat: HashSet::from_iter([GroupPermission::RemoveMembers, GroupPermission::DeleteMessages]),
            message: HashSet::from_iter([MessagePermission::Text, MessagePermission::Image, MessagePermission::Audio]),
        };

        (required, granted_to_bot, granted_to_user)
    }
}
