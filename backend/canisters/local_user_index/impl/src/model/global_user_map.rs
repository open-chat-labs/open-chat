use candid::Principal;
use serde::{Deserialize, Serialize};
use std::collections::{HashMap, HashSet};
use types::UserId;

#[derive(Serialize, Deserialize, Default)]
pub struct GlobalUserMap {
    user_id_to_principal: HashMap<UserId, Principal>,
    principal_to_user_id: HashMap<Principal, UserId>,
    super_admins: HashSet<UserId>,
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

    pub fn set_super_admin(&mut self, user_id: UserId, is_super_admin: bool) {
        if is_super_admin {
            self.super_admins.insert(user_id);
        } else {
            self.super_admins.remove(&user_id);
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
            is_super_admin: self.bots.contains(user_id),
        })
    }

    pub fn get_by_user_id(&self, user_id: &UserId) -> Option<GlobalUser> {
        self.user_id_to_principal.get(user_id).map(|principal| GlobalUser {
            user_id: *user_id,
            principal: *principal,
            is_bot: self.bots.contains(user_id),
            is_super_admin: self.bots.contains(user_id),
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
    pub is_super_admin: bool,
}
