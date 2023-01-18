use std::collections::HashMap;

use serde::{Deserialize, Serialize};
use types::{FieldTooLongResult, FieldTooShortResult, OptionUpdate, UserId};
use user_canister::set_contact::OptionalContact;

const MAX_NICKNAME_LEN: u32 = 32;
const MIN_NICKNAME_LEN: u32 = 2;

#[derive(Serialize, Deserialize, Default)]
pub struct Contacts {
    map: HashMap<UserId, Contact>,
}

#[derive(Serialize, Deserialize, Default)]
pub struct Contact {
    pub nickname: Option<String>,
}

pub enum SetContactResponse {
    Success,
    NoChange,
    NicknameTooShort(FieldTooShortResult),
    NicknameTooLong(FieldTooLongResult),
}

impl Contacts {
    pub fn set_contact(&mut self, contact: OptionalContact) -> SetContactResponse {
        match contact.nickname {
            OptionUpdate::NoChange => SetContactResponse::NoChange,
            OptionUpdate::SetToNone => {
                // TODO: When we add more fields to Contact then removing nickname probably
                // shouldn't result in removing the contact
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

                self.map.entry(contact.user_id).or_default().nickname = Some(nickname);

                SetContactResponse::Success
            }
        }
    }

    pub fn iter(&self) -> impl Iterator<Item = (&UserId, &Contact)> {
        self.map.iter()
    }
}
