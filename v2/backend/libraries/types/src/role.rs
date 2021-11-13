use candid::CandidType;
use serde::{Deserialize, Serialize};

#[derive(CandidType, Serialize, Deserialize, Copy, Clone, Debug)]
pub enum Role {
    SuperAdmin,
    Owner,
    Admin,
    Participant,
}

impl Role {
    pub fn is_owner(&self) -> bool {
        matches!(self, Role::Owner)
    }

    pub fn is_admin(&self) -> bool {
        matches!(self, Role::Admin)
    }

    pub fn is_super_admin(&self) -> bool {
        matches!(self, Role::SuperAdmin)
    }

    pub fn can_add_participants(&self, is_public_group: bool) -> bool {
        is_public_group || self.has_admin_rights()
    }

    pub fn can_remove_participants(&self) -> bool {
        self.has_admin_rights()
    }

    pub fn can_make_admin(&self) -> bool {
        self.has_admin_rights()
    }

    pub fn can_remove_admin(&self) -> bool {
        self.has_admin_rights()
    }

    pub fn can_block_user(&self) -> bool {
        self.has_admin_rights()
    }

    pub fn can_unblock_user(&self) -> bool {
        self.has_admin_rights()
    }

    pub fn can_set_avatar(&self) -> bool {
        self.has_admin_rights()
    }

    pub fn can_update_group(&self) -> bool {
        self.has_admin_rights()
    }

    pub fn can_delete_group(&self) -> bool {
        self.has_owner_rights()
    }

    pub fn can_delete_messages(&self) -> bool {
        self.has_admin_rights()
    }

    pub fn can_transfer_ownership(&self) -> bool {
        self.has_owner_rights()
    }

    pub fn can_be_removed(&self) -> bool {
        !self.has_owner_rights()
    }

    pub fn can_be_removed_as_admin(&self) -> bool {
        !self.has_owner_rights()
    }

    pub fn can_view_full_message_history(&self) -> bool {
        self.has_owner_rights()
    }

    fn has_admin_rights(&self) -> bool {
        matches!(self, Role::Admin) || self.has_owner_rights()
    }

    fn has_owner_rights(&self) -> bool {
        matches!(self, Role::Owner | Role::SuperAdmin)
    }
}
