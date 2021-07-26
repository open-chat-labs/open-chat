use candid::Principal;
use group_canister::common::participant::Participant;
use group_canister::common::role::Role;
use shared::time::TimestampMillis;
use shared::types::{MessageIndex, UserId};
use std::collections::HashMap;

#[derive(Default)]
pub struct Participants {
    by_principal: HashMap<Principal, Participant>,
}

impl Participants {
    pub fn new(creator_principal: Principal, creator_user_id: UserId, now: TimestampMillis) -> Participants {
        let participant = Participant {
            user_id: creator_user_id,
            date_added: now,
            role: Role::Admin,
            read_up_to: MessageIndex::default(),
            mute_notifications: false,
        };

        Participants {
            by_principal: vec![(creator_principal, participant)].into_iter().collect(),
        }
    }

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
