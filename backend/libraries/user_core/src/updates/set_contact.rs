use crate::model::all_ids_of;
use crate::{SetContactResponse, User};
use multi_user_canister::set_contact::{Args, OptionalContact};
use oc_error_codes::OCErrorCode;
use types::{OCResult, OptionUpdate};
use utils::migrated_user_ids::MigratedUserIds;

// The contact is set under the user's latest id, for a client which hasn't yet heard that they have
// been migrated to a MultiUser canister. One is removed under every id they have had, since a
// contact can still be under an id they had before until the `migrate_their_user_ids` job reaches
// the user.
pub fn set_contact(user: &mut User, mut args: Args, migrated_user_ids: &MigratedUserIds) -> OCResult {
    user.verify_not_suspended()?;

    let mut user_ids = all_ids_of(args.contact.user_id, migrated_user_ids);
    args.contact.user_id = user_ids.pop().unwrap();
    let mut removed_under_old_id = false;
    if matches!(args.contact.nickname, OptionUpdate::SetToNone) {
        for user_id in user_ids {
            let contact = OptionalContact {
                user_id,
                nickname: OptionUpdate::SetToNone,
            };
            removed_under_old_id |= matches!(user.contacts.set_contact(contact), SetContactResponse::Success);
        }
    }

    match user.contacts.set_contact(args.contact) {
        SetContactResponse::Success => Ok(()),
        SetContactResponse::NoChange if removed_under_old_id => Ok(()),
        SetContactResponse::NoChange => Err(OCErrorCode::NoChange.into()),
        SetContactResponse::NicknameTooLong(n) => Err(OCErrorCode::NameTooLong.with_json(&n)),
        SetContactResponse::NicknameTooShort(n) => Err(OCErrorCode::NameTooShort.with_json(&n)),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use candid::Principal;
    use ic_stable_structures::DefaultMemoryImpl;
    use ic_stable_structures::memory_manager::{MemoryId, MemoryManager};
    use types::UserId;

    fn user_id(i: u8) -> UserId {
        Principal::from_slice(&[i; 10]).into()
    }

    fn args(user_id: UserId, nickname: Option<&str>) -> Args {
        Args {
            contact: OptionalContact {
                user_id,
                nickname: match nickname {
                    Some(nickname) => OptionUpdate::SetToSome(nickname.to_string()),
                    None => OptionUpdate::SetToNone,
                },
            },
        }
    }

    fn contacts(user: &User) -> Vec<(UserId, Option<String>)> {
        user.contacts
            .all()
            .into_iter()
            .map(|(user_id, contact)| (user_id, contact.nickname))
            .collect()
    }

    #[test]
    fn contacts_are_set_under_the_latest_id_and_removed_under_both() {
        let memory = MemoryManager::init(DefaultMemoryImpl::default());
        stable_memory_map::init_with_small_entries_map(memory.get(MemoryId::new(1)), memory.get(MemoryId::new(2)));
        let (old, latest) = (user_id(2), user_id(3));
        let mut migrated_user_ids = MigratedUserIds::default();
        migrated_user_ids.insert(old, latest);
        let mut user = User::new(Principal::from_slice(&[1]), "user".to_string(), None, 0);

        set_contact(&mut user, args(old, Some("new")), &migrated_user_ids).unwrap();
        assert_eq!(contacts(&user), vec![(latest, Some("new".to_string()))]);

        // A contact still under the old id, before the user's contacts have been moved off it
        user.contacts.set_contact(args(old, Some("old")).contact);
        set_contact(&mut user, args(old, None), &migrated_user_ids).unwrap();
        assert!(contacts(&user).is_empty());

        // Whichever id they are named by
        user.contacts.set_contact(args(old, Some("old")).contact);
        set_contact(&mut user, args(latest, None), &migrated_user_ids).unwrap();
        assert!(contacts(&user).is_empty());
        let error = set_contact(&mut user, args(old, None), &migrated_user_ids).unwrap_err();
        assert!(error.matches_code(OCErrorCode::NoChange), "{error:?}");
    }
}
