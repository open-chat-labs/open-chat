use candid::Principal;
use serde::{Deserialize, Serialize};
use std::collections::{HashMap, HashSet};
use types::UserId;

#[derive(Serialize, Deserialize, Default)]
pub struct GlobalUserMap {
    user_id_to_principal: HashMap<UserId, Principal>,
    principal_to_user_id: HashMap<Principal, UserId>,
    platform_moderators: HashSet<UserId>,
    bots: HashSet<UserId>,
}

impl GlobalUserMap {
    pub fn add(&mut self, principal: Principal, user_id: UserId, is_bot: bool) {
        self.user_id_to_principal.insert(user_id, principal);
        self.principal_to_user_id.insert(principal, user_id);

        if is_bot {
            self.bots.insert(user_id);
        }
    }

    pub fn set_platform_moderator(&mut self, user_id: UserId, is_platform_moderator: bool) {
        if is_platform_moderator {
            self.platform_moderators.insert(user_id);
        } else {
            self.platform_moderators.remove(&user_id);
        }
    }

    pub fn get(&self, user_id_or_principal: &Principal) -> Option<GlobalUser> {
        self.get_by_principal(user_id_or_principal)
            .or_else(|| self.get_by_user_id(&UserId::from(*user_id_or_principal)))
    }

    pub fn get_by_principal(&self, principal: &Principal) -> Option<GlobalUser> {
        self.principal_to_user_id.get(principal).map(|user_id| GlobalUser {
            user_id: *user_id,
            principal: *principal,
            is_bot: self.bots.contains(user_id),
            is_platform_moderator: self.platform_moderators.contains(user_id),
        })
    }

    pub fn get_by_user_id(&self, user_id: &UserId) -> Option<GlobalUser> {
        self.user_id_to_principal.get(user_id).map(|principal| GlobalUser {
            user_id: *user_id,
            principal: *principal,
            is_bot: self.bots.contains(user_id),
            is_platform_moderator: self.platform_moderators.contains(user_id),
        })
    }

    pub fn is_bot(&self, user_id: &UserId) -> bool {
        self.bots.contains(user_id)
    }

    pub fn len(&self) -> usize {
        self.user_id_to_principal.len()
    }
}

pub struct GlobalUser {
    pub user_id: UserId,
    pub principal: Principal,
    pub is_bot: bool,
    pub is_platform_moderator: bool,
}
