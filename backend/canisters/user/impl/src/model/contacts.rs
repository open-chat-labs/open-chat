use std::collections::{HashMap, HashSet};

use serde::{Deserialize, Serialize};
use types::{FieldTooLongResult, FieldTooShortResult, OptionUpdate, UserId};
use user_canister::set_contact::OptionalContact;

const MAX_NICKNAME_LEN: u32 = 32;
const MIN_NICKNAME_LEN: u32 = 2;

#[derive(Serialize, Deserialize, Default)]
pub struct Contacts {
    map: HashMap<UserId, Contact>,
    nicknames: HashSet<String>,
}

#[derive(Serialize, Deserialize, Default)]
pub struct Contact {
    pub nickname: Option<String>,
}

pub enum SetContactResponse {
    Success,
    NoChange,
    NicknameNameAlreadyUsed,
    NicknameTooShort(FieldTooShortResult),
    NicknameTooLong(FieldTooLongResult),
}

impl Contacts {
    pub fn set_contact(&mut self, contact: OptionalContact) -> SetContactResponse {
        match contact.nickname {
            OptionUpdate::NoChange => SetContactResponse::NoChange,
            OptionUpdate::SetToNone => {
                if self.map.remove(&contact.user_id).is_some() {
                    SetContactResponse::Success
                } else {
                    SetContactResponse::NoChange
                }
            }
            OptionUpdate::SetToSome(nickname) => {
                let nickname = nickname.trim().to_string();
                let length_provided = nickname.len() as u32;

                if length_provided > MAX_NICKNAME_LEN {
                    return SetContactResponse::NicknameTooLong(FieldTooLongResult {
                        length_provided,
                        max_length: MAX_NICKNAME_LEN,
                    });
                }

                if length_provided < MIN_NICKNAME_LEN {
                    return SetContactResponse::NicknameTooShort(FieldTooShortResult {
                        length_provided,
                        min_length: MIN_NICKNAME_LEN,
                    });
                }

                if self.nicknames.contains(&nickname) {
                    return SetContactResponse::NicknameNameAlreadyUsed;
                }

                self.map
                    .entry(contact.user_id)
                    .and_modify(|e| {
                        if let Some(curr_nickname) = &e.nickname {
                            self.nicknames.remove(curr_nickname);
                        }
                        e.nickname = Some(nickname.clone());
                        self.nicknames.insert(nickname.clone());
                    })
                    .or_insert(Contact {
                        nickname: Some(nickname),
                    });

                SetContactResponse::Success
            }
        }
    }

    pub fn iter(&self) -> impl Iterator<Item = (&UserId, &Contact)> {
        self.map.iter()
    }
}
