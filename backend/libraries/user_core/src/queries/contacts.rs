use crate::User;
use user_canister::contacts::{Contact, SuccessResult};

pub fn contacts(user: &User) -> SuccessResult {
    SuccessResult {
        contacts: user
            .contacts
            .all()
            .into_iter()
            .map(|(user_id, contact)| Contact {
                user_id,
                nickname: contact.nickname,
            })
            .collect(),
    }
}
