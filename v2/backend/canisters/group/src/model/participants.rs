use crate::model::participant::Participant;
use candid::Principal;
use shared::types::UserId;
use std::collections::HashMap;

#[derive(Default)]
pub struct Participants {
    by_principal: HashMap<Principal, Participant>,
}

impl Participants {
    pub fn get_by_principal(&self, principal: &Principal) -> Option<&Participant> {
        self.by_principal.get(principal)
    }

    pub fn get_by_principal_mut(&mut self, principal: &Principal) -> Option<&mut Participant> {
        self.by_principal.get_mut(principal)
    }

    pub fn get_other_user_ids(&self, my_user_id: UserId) -> Vec<UserId> {
        self.by_principal
            .values()
            .filter(|p| p.user_id != my_user_id)
            .map(|p| p.user_id)
            .collect()
    }
}
