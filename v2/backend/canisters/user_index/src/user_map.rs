use candid::Principal;
use crate::model::user::User;
use std::collections::HashMap;
use phonenumber::PhoneNumber;

#[derive(Default)]
pub struct UserMap {
    users_by_principal: HashMap<Principal, User>,
    phone_number_to_principal: HashMap<PhoneNumber, Principal>,
    username_to_principal: HashMap<String, Principal>,
    user_id_to_principal: HashMap<Principal, Principal>,
}

impl UserMap {
    pub fn add(&mut self, user: User) -> AddUserResult {
        let principal = user.get_principal();
        let phone_number = user.get_phone_number();
        let maybe_username = user.get_username();
        let maybe_user_id = user.get_user_id();

        if self.users_by_principal.contains_key(&principal) {
            AddUserResult::AlreadyExists
        } else if self.phone_number_to_principal.contains_key(phone_number) {
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
            self.users_by_principal.insert(principal, user);
            AddUserResult::Success
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
                if previous_username.is_some() {
                    self.username_to_principal.remove(previous_username.unwrap());
                }
                if username.is_some() {
                    self.username_to_principal.insert(username.unwrap().to_string(), principal);
                }
            }

            if previous_user_id != user_id {
                if previous_user_id.is_some() {
                    self.user_id_to_principal.remove(&previous_user_id.unwrap());
                }
                if user_id.is_some() {
                    self.user_id_to_principal.insert(user_id.unwrap(), principal);
                }
            }

            self.users_by_principal.insert(principal, user);
            UpdateUserResult::Success
        } else {
            UpdateUserResult::UserNotFound
        }
    }

    pub fn get_by_principal(&self, principal: &Principal) -> Option<&User> {
        self.users_by_principal.get(principal)
    }

    #[allow(dead_code)]
    pub fn get_by_user_id(&self, user_id: &Principal) -> Option<&User> {
        self.user_id_to_principal.get(user_id).map(|p| self.users_by_principal.get(p)).flatten()
    }

    pub fn get_by_phone_number(&self, phone_number: &PhoneNumber) -> Option<&User> {
        self.phone_number_to_principal.get(phone_number).map(|p| self.users_by_principal.get(p)).flatten()
    }

    #[allow(dead_code)]
    pub fn get_by_username(&self, username: &str) -> Option<&User> {
        self.username_to_principal.get(username).map(|p| self.users_by_principal.get(p)).flatten()
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
