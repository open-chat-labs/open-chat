use crate::model::participant::Participant;
use candid::Principal;
use std::collections::HashMap;

#[derive(Default)]
pub struct Participants {
    by_principal: HashMap<Principal, Participant>,
}

impl Participants {
    pub fn get_by_principal(&self, principal: &Principal) -> Option<&Participant> {
        self.by_principal.get(principal)
    }
}
