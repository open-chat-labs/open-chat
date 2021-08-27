use candid::CandidType;
use serde::Deserialize;

#[derive(CandidType, Deserialize, Copy, Clone, Debug)]
pub enum Role {
    Admin,
    Participant,
}

impl Role {
    pub fn can_add_participants(&self, is_public_group: bool) -> bool {
        is_public_group || matches!(self, Role::Admin)
    }

    pub fn can_remove_participants(&self) -> bool {
        matches!(self, Role::Admin)
    }

    pub fn can_make_admin(&self) -> bool {
        matches!(self, Role::Admin)
    }

    pub fn can_remove_admin(&self) -> bool {
        matches!(self, Role::Admin)
    }

    pub fn can_block_user(&self) -> bool {
        matches!(self, Role::Admin)
    }

    pub fn can_unblock_user(&self) -> bool {
        matches!(self, Role::Admin)
    }
}
