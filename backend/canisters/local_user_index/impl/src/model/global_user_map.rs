use candid::Principal;
use local_user_index_canister::GlobalUser;
use principal_to_user_id_map::PrincipalToUserIdMap;
use serde::{Deserialize, Serialize};
use stable_memory_map::StableMemoryMap;
use std::collections::{HashMap, HashSet};
use types::{TimestampMillis, UniquePersonProof, UserId, UserType};

#[derive(Serialize, Deserialize, Default)]
pub struct GlobalUserMap {
    user_id_to_principal: HashMap<UserId, Principal>,
    principal_to_user_id: PrincipalToUserIdMap,
    unique_person_proofs: HashMap<UserId, UniquePersonProof>,
    platform_moderators: HashSet<UserId>,
    legacy_bots: HashSet<UserId>,
    oc_controlled_bot_users: HashSet<UserId>,
    diamond_membership_expiry_dates: HashMap<UserId, TimestampMillis>,
}

impl GlobalUserMap {
    pub fn add(&mut self, principal: Principal, user_id: UserId, user_type: UserType) {
        self.user_id_to_principal.insert(user_id, principal);
        self.principal_to_user_id.insert(principal, user_id);

        if user_type.is_bot() {
            self.legacy_bots.insert(user_id);

            if user_type.is_oc_controlled_bot() {
                self.oc_controlled_bot_users.insert(user_id);
            }
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
        self.principal_to_user_id
            .get(principal)
            .map(|user_id| self.hydrate_user(user_id, *principal))
    }

    pub fn get_by_user_id(&self, user_id: &UserId) -> Option<GlobalUser> {
        self.user_id_to_principal
            .get(user_id)
            .map(|principal| self.hydrate_user(*user_id, *principal))
    }

    pub fn contains(&self, user_id: &UserId) -> bool {
        self.user_id_to_principal.contains_key(user_id)
    }

    pub fn diamond_membership_expiry_date(&self, user_id: &UserId) -> Option<TimestampMillis> {
        self.diamond_membership_expiry_dates.get(user_id).copied()
    }

    pub fn set_diamond_membership_expiry_date(&mut self, user_id: UserId, expires_at: TimestampMillis) {
        self.diamond_membership_expiry_dates.insert(user_id, expires_at);
    }

    pub fn update_user_principal(&mut self, old_principal: Principal, new_principal: Principal) {
        if let Some(user_id) = self.principal_to_user_id.remove(&old_principal).map(|v| v.into_value()) {
            self.principal_to_user_id.insert(new_principal, user_id);
            self.user_id_to_principal.insert(user_id, new_principal);
        }
    }

    pub fn remove(&mut self, user_id: &UserId) -> bool {
        if let Some(principal) = self.user_id_to_principal.remove(user_id) {
            if self.principal_to_user_id.get(&principal) == Some(*user_id) {
                self.principal_to_user_id.remove(&principal);
            }
            self.platform_moderators.remove(user_id);
            self.legacy_bots.remove(user_id);
            self.diamond_membership_expiry_dates.remove(user_id);
            true
        } else {
            false
        }
    }

    pub fn insert_unique_person_proof(&mut self, user_id: UserId, proof: UniquePersonProof) {
        self.unique_person_proofs.insert(user_id, proof);
    }

    pub fn is_bot(&self, user_id: &UserId) -> bool {
        self.legacy_bots.contains(user_id)
    }

    pub fn len(&self) -> usize {
        self.user_id_to_principal.len()
    }

    pub fn legacy_bots(&self) -> &HashSet<UserId> {
        &self.legacy_bots
    }

    pub fn oc_controlled_bots(&self) -> &HashSet<UserId> {
        &self.oc_controlled_bot_users
    }

    pub fn is_diamond_member(&self, user_id: &UserId, now: TimestampMillis) -> bool {
        self.diamond_membership_expiry_date(user_id).is_some_and(|t| t > now)
    }

    fn hydrate_user(&self, user_id: UserId, principal: Principal) -> GlobalUser {
        let user_type = if self.oc_controlled_bot_users.contains(&user_id) {
            UserType::OcControlledBot
        } else if self.legacy_bots.contains(&user_id) {
            UserType::Bot
        } else {
            UserType::User
        };

        GlobalUser {
            user_id,
            principal,
            is_platform_moderator: self.platform_moderators.contains(&user_id),
            diamond_membership_expires_at: self.diamond_membership_expiry_dates.get(&user_id).copied(),
            unique_person_proof: self.unique_person_proofs.get(&user_id).cloned(),
            user_type,
        }
    }
}
