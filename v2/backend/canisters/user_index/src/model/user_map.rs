use crate::model::user::User;
use candid::Principal;
use phonenumber::PhoneNumber;
use shared::time::TimestampMillis;
use shared::types::UserId;
use std::collections::hash_map;
use std::collections::hash_map::Entry::Vacant;
use std::collections::HashMap;

#[derive(Default)]
pub struct UserMap {
    users_by_principal: HashMap<Principal, User>,
    phone_number_to_principal: HashMap<PhoneNumber, Principal>,
    username_to_principal: HashMap<String, Principal>,
    user_id_to_principal: HashMap<UserId, Principal>,
}

impl UserMap {
    pub fn add(&mut self, user: User) -> AddUserResult {
        let principal = user.get_principal();
        let phone_number = user.get_phone_number();
        let maybe_username = user.get_username();
        let maybe_user_id = user.get_user_id();

        if let Vacant(principal_entry) = self.users_by_principal.entry(principal) {
            if self.phone_number_to_principal.contains_key(phone_number) {
                AddUserResult::PhoneNumberTaken
            } else if maybe_username.is_some() && self.username_to_principal.contains_key(maybe_username.unwrap()) {
                AddUserResult::UsernameTaken
            } else {
                self.phone_number_to_principal.insert(phone_number.clone(), principal);
                if let Some(username) = maybe_username {
                    self.username_to_principal.insert(username.to_string(), principal);
                }
                if let Some(user_id) = maybe_user_id {
                    self.user_id_to_principal.insert(user_id, principal);
                }
                principal_entry.insert(user);
                AddUserResult::Success
            }
        } else {
            AddUserResult::AlreadyExists
        }
    }

    pub fn update(&mut self, user: User) -> UpdateUserResult {
        let principal = user.get_principal();

        if let Some(previous) = self.users_by_principal.get(&principal) {
            let previous_phone_number = previous.get_phone_number();
            let phone_number = user.get_phone_number();

            let previous_username = previous.get_username();
            let username = user.get_username();

            let previous_user_id = previous.get_user_id();
            let user_id = user.get_user_id();

            let new_phone_number_added = previous_phone_number != phone_number;
            let new_username_added = username.is_some() && previous_username != username;

            if new_phone_number_added && self.phone_number_to_principal.contains_key(phone_number) {
                return UpdateUserResult::PhoneNumberTaken;
            }
            if new_username_added && self.username_to_principal.contains_key(username.unwrap()) {
                return UpdateUserResult::UsernameTaken;
            }

            if new_phone_number_added {
                self.phone_number_to_principal.remove(previous_phone_number);
                self.phone_number_to_principal.insert(phone_number.clone(), principal);
            }

            if previous_username != username {
                if let Some(val) = previous_username {
                    self.username_to_principal.remove(val);
                }
                if let Some(val) = username {
                    self.username_to_principal.insert(val.to_string(), principal);
                }
            }

            if previous_user_id != user_id {
                if let Some(val) = previous_user_id {
                    self.user_id_to_principal.remove(&val);
                }
                if let Some(val) = user_id {
                    self.user_id_to_principal.insert(val, principal);
                }
            }

            self.users_by_principal.insert(principal, user);
            UpdateUserResult::Success
        } else {
            UpdateUserResult::UserNotFound
        }
    }

    pub fn mark_online(&mut self, principal: &Principal, now: TimestampMillis) {
        if let Some(User::Created(user)) = self.users_by_principal.get_mut(principal) {
            user.last_online = now;
        }
    }

    pub fn get_by_principal(&self, principal: &Principal) -> Option<&User> {
        self.users_by_principal.get(principal)
    }

    #[allow(dead_code)]
    pub fn get_by_user_id(&self, user_id: &UserId) -> Option<&User> {
        self.user_id_to_principal
            .get(user_id)
            .map(|p| self.users_by_principal.get(p))
            .flatten()
    }

    pub fn get_by_phone_number(&self, phone_number: &PhoneNumber) -> Option<&User> {
        self.phone_number_to_principal
            .get(phone_number)
            .map(|p| self.users_by_principal.get(p))
            .flatten()
    }

    #[allow(dead_code)]
    pub fn get_by_username(&self, username: &str) -> Option<&User> {
        self.username_to_principal
            .get(username)
            .map(|p| self.users_by_principal.get(p))
            .flatten()
    }

    pub fn remove_by_principal(&mut self, principal: &Principal) -> Option<User> {
        if let Some(user) = self.users_by_principal.remove(principal) {
            self.phone_number_to_principal.remove(user.get_phone_number());

            if let Some(username) = user.get_username() {
                self.username_to_principal.remove(username);
            }
            if let Some(user_id) = user.get_user_id() {
                self.user_id_to_principal.remove(&user_id);
            }
            Some(user)
        } else {
            None
        }
    }

    pub fn values(&self) -> hash_map::Values<'_, Principal, User> {
        self.users_by_principal.values()
    }
}

pub enum AddUserResult {
    Success,
    AlreadyExists,
    PhoneNumberTaken,
    UsernameTaken,
}

pub enum UpdateUserResult {
    Success,
    PhoneNumberTaken,
    UsernameTaken,
    UserNotFound,
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::model::user::{CanisterCreationStatus, ConfirmedUser, CreatedUser, UnconfirmedUser};
    use itertools::Itertools;
    use std::str::FromStr;

    #[test]
    fn add_with_no_clashes() {
        let mut user_map = UserMap::default();
        let principal1 = Principal::from_slice(&[1]);
        let principal2 = Principal::from_slice(&[2]);
        let principal3 = Principal::from_slice(&[3]);

        let phone_number1 = PhoneNumber::from_str("+441111111111").unwrap();
        let phone_number2 = PhoneNumber::from_str("+442222222222").unwrap();
        let phone_number3 = PhoneNumber::from_str("+443333333333").unwrap();

        let username2 = "2".to_string();
        let username3 = "3".to_string();

        let user_id2 = Principal::from_slice(&[2, 2]).into();
        let user_id3 = Principal::from_slice(&[3, 3]).into();

        let unconfirmed = User::Unconfirmed(UnconfirmedUser {
            principal: principal1,
            phone_number: phone_number1.clone(),
            confirmation_code: "1".to_string(),
            date_generated: 1,
            sms_messages_sent: 1,
        });
        user_map.add(unconfirmed.clone());

        let confirmed = User::Confirmed(ConfirmedUser {
            principal: principal2,
            phone_number: phone_number2.clone(),
            user_id: Some(user_id2),
            username: Some(username2.clone()),
            canister_creation_status: CanisterCreationStatus::Pending,
            date_confirmed: 2,
        });
        user_map.add(confirmed.clone());

        let created = User::Created(CreatedUser {
            principal: principal3,
            phone_number: phone_number3.clone(),
            user_id: user_id3,
            username: username3.clone(),
            date_created: 3,
            date_updated: 3,
            last_online: 1,
            wasm_version: semver::Version::new(0, 0, 0),
        });
        user_map.add(created.clone());

        let users_by_principal: Vec<_> = user_map
            .users_by_principal
            .iter()
            .map(|(p, u)| (p.clone(), u.clone()))
            .sorted_by_key(|(p, _)| *p)
            .collect();
        let phone_number_to_principal: Vec<_> = user_map
            .phone_number_to_principal
            .iter()
            .map(|(ph, p)| (ph.clone(), p.clone()))
            .sorted_by_key(|(_, p)| *p)
            .collect();
        let username_to_principal: Vec<_> = user_map
            .username_to_principal
            .iter()
            .map(|(u, p)| (u.clone(), p.clone()))
            .sorted_by_key(|(_, p)| *p)
            .collect();
        let user_id_to_principal: Vec<_> = user_map
            .user_id_to_principal
            .iter()
            .map(|(u, p)| (u.clone(), p.clone()))
            .sorted_by_key(|(_, p)| *p)
            .collect();

        assert_eq!(
            users_by_principal,
            vec!((principal1, unconfirmed), (principal2, confirmed), (principal3, created))
        );
        assert_eq!(
            phone_number_to_principal,
            vec!(
                (phone_number1, principal1),
                (phone_number2, principal2),
                (phone_number3, principal3)
            )
        );
        assert_eq!(username_to_principal, vec!((username2, principal2), (username3, principal3)));
        assert_eq!(user_id_to_principal, vec!((user_id2, principal2), (user_id3, principal3)));
    }

    #[test]
    fn add_with_clashing_principal() {
        let mut user_map = UserMap::default();
        let principal = Principal::from_slice(&[1]);

        let phone_number1 = PhoneNumber::from_str("+441111111111").unwrap();
        let phone_number2 = PhoneNumber::from_str("+442222222222").unwrap();

        let user_id = Principal::from_slice(&[1, 1]).into();

        let unconfirmed = User::Unconfirmed(UnconfirmedUser {
            principal,
            phone_number: phone_number1.clone(),
            confirmation_code: "1".to_string(),
            date_generated: 1,
            sms_messages_sent: 1,
        });
        user_map.add(unconfirmed);

        let confirmed = User::Confirmed(ConfirmedUser {
            principal,
            phone_number: phone_number2.clone(),
            user_id: Some(user_id),
            username: Some("2".to_string()),
            canister_creation_status: CanisterCreationStatus::Pending,
            date_confirmed: 2,
        });
        assert!(matches!(user_map.add(confirmed), AddUserResult::AlreadyExists));
        assert_eq!(user_map.users_by_principal.len(), 1);
    }

    #[test]
    fn add_with_clashing_phone_number() {
        let mut user_map = UserMap::default();
        let principal1 = Principal::from_slice(&[1]);
        let principal2 = Principal::from_slice(&[2]);

        let phone_number = PhoneNumber::from_str("+441111111111").unwrap();

        let user_id = Principal::from_slice(&[2, 2]).into();

        let unconfirmed = User::Unconfirmed(UnconfirmedUser {
            principal: principal1,
            phone_number: phone_number.clone(),
            confirmation_code: "1".to_string(),
            date_generated: 1,
            sms_messages_sent: 1,
        });
        user_map.add(unconfirmed);

        let confirmed = User::Confirmed(ConfirmedUser {
            principal: principal2,
            phone_number,
            user_id: Some(user_id),
            username: Some("2".to_string()),
            canister_creation_status: CanisterCreationStatus::Pending,
            date_confirmed: 2,
        });
        assert!(matches!(user_map.add(confirmed), AddUserResult::PhoneNumberTaken));
        assert_eq!(user_map.users_by_principal.len(), 1);
    }

    #[test]
    fn add_with_clashing_username() {
        let mut user_map = UserMap::default();
        let principal1 = Principal::from_slice(&[1]);
        let principal2 = Principal::from_slice(&[2]);

        let phone_number1 = PhoneNumber::from_str("+441111111111").unwrap();
        let phone_number2 = PhoneNumber::from_str("+442222222222").unwrap();

        let user_id1 = Principal::from_slice(&[1, 1]).into();
        let user_id2 = Principal::from_slice(&[2, 2]).into();

        let username = "1".to_string();

        let confirmed = User::Confirmed(ConfirmedUser {
            principal: principal1,
            phone_number: phone_number1,
            user_id: Some(user_id1),
            username: Some(username.clone()),
            canister_creation_status: CanisterCreationStatus::Pending,
            date_confirmed: 2,
        });
        user_map.add(confirmed);

        let created = User::Created(CreatedUser {
            principal: principal2,
            phone_number: phone_number2,
            user_id: user_id2,
            username,
            date_created: 3,
            date_updated: 3,
            last_online: 3,
            wasm_version: semver::Version::new(0, 0, 0),
        });
        assert!(matches!(user_map.add(created), AddUserResult::UsernameTaken));
        assert_eq!(user_map.users_by_principal.len(), 1);
    }

    #[test]
    fn update_with_no_clashes() {
        let mut user_map = UserMap::default();
        let principal = Principal::from_slice(&[1]);

        let phone_number1 = PhoneNumber::from_str("+441111111111").unwrap();
        let phone_number2 = PhoneNumber::from_str("+442222222222").unwrap();

        let username1 = "1".to_string();
        let username2 = "2".to_string();

        let user_id = Principal::from_slice(&[1, 1]).into();

        let original = User::Created(CreatedUser {
            principal,
            phone_number: phone_number1.clone(),
            user_id,
            username: username1.clone(),
            date_created: 1,
            date_updated: 1,
            last_online: 1,
            wasm_version: semver::Version::new(0, 0, 0),
        });

        let mut updated = original.clone();
        updated.set_username(username2.clone(), 4);
        updated.set_phone_number(phone_number2.clone(), 4);

        user_map.add(original);
        assert!(matches!(user_map.update(updated), UpdateUserResult::Success));

        assert_eq!(user_map.users_by_principal.keys().collect_vec(), vec!(&principal));
        assert_eq!(user_map.phone_number_to_principal.keys().collect_vec(), vec!(&phone_number2));
        assert_eq!(user_map.username_to_principal.keys().collect_vec(), vec!(&username2));
        assert_eq!(user_map.user_id_to_principal.keys().collect_vec(), vec!(&user_id));
    }

    #[test]
    fn update_with_clashing_phone_number() {
        let mut user_map = UserMap::default();
        let principal1 = Principal::from_slice(&[1]);
        let principal2 = Principal::from_slice(&[2]);

        let phone_number1 = PhoneNumber::from_str("+441111111111").unwrap();
        let phone_number2 = PhoneNumber::from_str("+442222222222").unwrap();

        let username1 = "1".to_string();
        let username2 = "2".to_string();

        let user_id1 = Principal::from_slice(&[1, 1]).into();
        let user_id2 = Principal::from_slice(&[2, 2]).into();

        let original = User::Created(CreatedUser {
            principal: principal1,
            phone_number: phone_number1,
            user_id: user_id1,
            username: username1.clone(),
            date_created: 1,
            date_updated: 1,
            last_online: 1,
            wasm_version: semver::Version::new(0, 0, 0),
        });

        let other = User::Created(CreatedUser {
            principal: principal2,
            phone_number: phone_number2.clone(),
            user_id: user_id2,
            username: username2.clone(),
            date_created: 2,
            date_updated: 2,
            last_online: 2,
            wasm_version: semver::Version::new(0, 0, 0),
        });

        let mut updated = original.clone();
        updated.set_phone_number(phone_number2, 4);

        user_map.add(original);
        user_map.add(other);
        assert!(matches!(user_map.update(updated), UpdateUserResult::PhoneNumberTaken));
    }

    #[test]
    fn update_with_clashing_username() {
        let mut user_map = UserMap::default();
        let principal1 = Principal::from_slice(&[1]);
        let principal2 = Principal::from_slice(&[2]);

        let phone_number1 = PhoneNumber::from_str("+441111111111").unwrap();
        let phone_number2 = PhoneNumber::from_str("+442222222222").unwrap();

        let username1 = "1".to_string();
        let username2 = "2".to_string();

        let user_id1 = Principal::from_slice(&[1, 1]).into();
        let user_id2 = Principal::from_slice(&[2, 2]).into();

        let original = User::Created(CreatedUser {
            principal: principal1,
            phone_number: phone_number1,
            user_id: user_id1,
            username: username1.clone(),
            date_created: 1,
            date_updated: 1,
            last_online: 1,
            wasm_version: semver::Version::new(0, 0, 0),
        });

        let other = User::Created(CreatedUser {
            principal: principal2,
            phone_number: phone_number2.clone(),
            user_id: user_id2,
            username: username2.clone(),
            date_created: 2,
            date_updated: 2,
            last_online: 2,
            wasm_version: semver::Version::new(0, 0, 0),
        });

        let mut updated = original.clone();
        updated.set_phone_number(phone_number2, 4);

        user_map.add(original);
        user_map.add(other);
        assert!(matches!(user_map.update(updated), UpdateUserResult::PhoneNumberTaken));
    }

    #[test]
    fn remove() {
        let mut user_map = UserMap::default();
        let principal1 = Principal::from_slice(&[1]);
        let principal2 = Principal::from_slice(&[2]);
        let principal3 = Principal::from_slice(&[3]);

        let phone_number1 = PhoneNumber::from_str("+441111111111").unwrap();
        let phone_number2 = PhoneNumber::from_str("+442222222222").unwrap();
        let phone_number3 = PhoneNumber::from_str("+443333333333").unwrap();

        let username2 = "2".to_string();
        let username3 = "3".to_string();

        let user_id2 = Principal::from_slice(&[2, 2]).into();
        let user_id3 = Principal::from_slice(&[3, 3]).into();

        let unconfirmed = User::Unconfirmed(UnconfirmedUser {
            principal: principal1,
            phone_number: phone_number1.clone(),
            confirmation_code: "1".to_string(),
            date_generated: 1,
            sms_messages_sent: 1,
        });
        user_map.add(unconfirmed.clone());

        let confirmed = User::Confirmed(ConfirmedUser {
            principal: principal2,
            phone_number: phone_number2.clone(),
            user_id: Some(user_id2),
            username: Some(username2.clone()),
            canister_creation_status: CanisterCreationStatus::Pending,
            date_confirmed: 2,
        });
        user_map.add(confirmed.clone());

        let created = User::Created(CreatedUser {
            principal: principal3,
            phone_number: phone_number3.clone(),
            user_id: user_id3,
            username: username3.clone(),
            date_created: 3,
            date_updated: 3,
            last_online: 3,
            wasm_version: semver::Version::new(0, 0, 0),
        });
        user_map.add(created.clone());

        user_map.remove_by_principal(&principal1);
        user_map.remove_by_principal(&principal2);
        user_map.remove_by_principal(&principal3);

        assert_eq!(user_map.users_by_principal.len(), 0);
        assert_eq!(user_map.phone_number_to_principal.len(), 0);
        assert_eq!(user_map.username_to_principal.len(), 0);
        assert_eq!(user_map.user_id_to_principal.len(), 0);
    }
}
