use candid::Principal;
use serde::{Deserialize, Serialize};
use stable_memory_map::{ContactKey, ContactKeyPrefix, EntryExt, KeyPrefix, with_map, with_map_mut};
use std::ops::RangeInclusive;
use types::{FieldTooLongResult, FieldTooShortResult, OptionUpdate, UserId};
use user_canister::set_contact::OptionalContact;

const MAX_NICKNAME_LEN: u32 = 32;
const MIN_NICKNAME_LEN: u32 = 2;

// The user's contacts, stored in the main stable memory map keyed by user id. It has braces, rather
// than being a unit struct, since it is serialized as an empty map.
#[derive(Serialize, Deserialize, Default)]
pub struct Contacts {}

// Each contact is serialized into stable memory, so its field names are kept short
#[derive(Serialize, Deserialize, Clone, Debug, Default, PartialEq, Eq)]
pub struct Contact {
    #[serde(rename = "n", default, skip_serializing_if = "Option::is_none")]
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
        let key = ContactKeyPrefix::new().create_key(&contact.user_id);

        match contact.nickname {
            OptionUpdate::NoChange => SetContactResponse::NoChange,
            OptionUpdate::SetToNone => {
                // TODO: When we add more fields to Contact then removing nickname probably
                // shouldn't result in removing the contact
                if with_map_mut(|m| m.remove(key)).is_some() {
                    SetContactResponse::Success
                } else {
                    SetContactResponse::NoChange
                }
            }
            OptionUpdate::SetToSome(nickname) => {
                let nickname = nickname.trim().to_string();
                let length_provided = nickname.chars().count() as u32;

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

                with_map_mut(|m| {
                    let entry = m.entry(key);
                    let mut value = entry.value().map(|bytes| contact_from_bytes(&bytes)).unwrap_or_default();
                    value.nickname = Some(nickname);
                    entry.set(contact_to_bytes(&value));
                });

                SetContactResponse::Success
            }
        }
    }

    // Moves the contact for another user onto their new id once they are migrated to a MultiUser
    // canister, unless there is already one for their new id
    pub fn migrate_user_id(&mut self, old_user_id: UserId, new_user_id: UserId) {
        let prefix = ContactKeyPrefix::new();
        with_map_mut(|m| {
            if m.contains_key(prefix.create_key(&new_user_id)) {
                return;
            }
            if let Some(bytes) = m.remove(prefix.create_key(&old_user_id)) {
                m.insert(prefix.create_key(&new_user_id), bytes);
            }
        });
    }

    // Returns every contact, ordered by user id
    pub fn all(&self) -> Vec<(UserId, Contact)> {
        with_map(|m| {
            m.range(all_keys())
                .map(|(key, bytes)| (key.user_id(), contact_from_bytes(&bytes)))
                .collect()
        })
    }
}

fn all_keys() -> RangeInclusive<ContactKey> {
    // User ids are at most 29 bytes
    let prefix = ContactKeyPrefix::new();
    prefix.create_key(&UserId::new(Principal::from_slice(&[])))
        ..=prefix.create_key(&UserId::new(Principal::from_slice(&[u8::MAX; 29])))
}

fn contact_to_bytes(contact: &Contact) -> Vec<u8> {
    msgpack::serialize_then_unwrap(contact)
}

fn contact_from_bytes(bytes: &[u8]) -> Contact {
    msgpack::deserialize_then_unwrap(bytes)
}

#[cfg(test)]
mod tests {
    use super::*;
    use ic_stable_structures::DefaultMemoryImpl;
    use ic_stable_structures::memory_manager::{MemoryId, MemoryManager};

    #[test]
    fn contacts_can_be_set_updated_and_removed() {
        init_stable_memory_map();
        let mut contacts = Contacts::default();

        for i in [3, 1, 2] {
            assert!(matches!(
                contacts.set_contact(set_nickname(i, &format!("  nickname{i} "))),
                SetContactResponse::Success
            ));
        }
        assert_eq!(
            nicknames(&contacts),
            owned(&[(1, "nickname1"), (2, "nickname2"), (3, "nickname3")])
        );

        assert!(matches!(
            contacts.set_contact(set_nickname(2, "updated")),
            SetContactResponse::Success
        ));
        assert!(matches!(
            contacts.set_contact(OptionalContact {
                user_id: user_id(1),
                nickname: OptionUpdate::NoChange,
            }),
            SetContactResponse::NoChange
        ));
        assert_eq!(
            nicknames(&contacts),
            owned(&[(1, "nickname1"), (2, "updated"), (3, "nickname3")])
        );

        assert!(matches!(
            contacts.set_contact(remove_nickname(1)),
            SetContactResponse::Success
        ));
        assert!(matches!(
            contacts.set_contact(remove_nickname(1)),
            SetContactResponse::NoChange
        ));
        assert_eq!(nicknames(&contacts), owned(&[(2, "updated"), (3, "nickname3")]));
    }

    #[test]
    fn contact_for_a_migrated_user_is_moved_onto_their_new_id() {
        init_stable_memory_map();
        let mut contacts = Contacts::default();
        contacts.set_contact(set_nickname(1, "one"));
        contacts.set_contact(set_nickname(2, "two"));
        contacts.set_contact(set_nickname(3, "three"));

        contacts.migrate_user_id(user_id(1), user_id(4));
        assert_eq!(nicknames(&contacts), owned(&[(2, "two"), (3, "three"), (4, "one")]));

        // A contact already held for the new id is kept
        contacts.migrate_user_id(user_id(2), user_id(3));
        assert_eq!(nicknames(&contacts), owned(&[(2, "two"), (3, "three"), (4, "one")]));
    }

    #[test]
    fn invalid_nicknames_are_rejected() {
        init_stable_memory_map();
        let mut contacts = Contacts::default();

        assert!(matches!(
            contacts.set_contact(set_nickname(1, " a ")),
            SetContactResponse::NicknameTooShort(FieldTooShortResult { length_provided: 1, .. })
        ));
        assert!(matches!(
            contacts.set_contact(set_nickname(1, &"a".repeat(33))),
            SetContactResponse::NicknameTooLong(FieldTooLongResult { length_provided: 33, .. })
        ));
        assert!(contacts.all().is_empty());
    }

    #[test]
    fn contacts_are_serialized_as_an_empty_map() {
        let bytes = msgpack::serialize_then_unwrap(Contacts::default());
        assert_eq!(bytes, [0x80]);
        let _: Contacts = msgpack::deserialize_then_unwrap(&bytes);
    }

    #[test]
    fn contacts_use_short_field_names() {
        let contact = Contact {
            nickname: Some("abc".to_string()),
        };
        let bytes = contact_to_bytes(&contact);
        // A map with 1 entry, the key "n", then the string "abc"
        assert_eq!(bytes, [0x81, 0xa1, b'n', 0xa3, b'a', b'b', b'c']);
        assert_eq!(contact_from_bytes(&bytes), contact);

        // An empty contact deserializes, so fields can be made optional in future
        assert_eq!(contact_from_bytes(&contact_to_bytes(&Contact::default())), Contact::default());
    }

    fn nicknames(contacts: &Contacts) -> Vec<(u8, String)> {
        contacts
            .all()
            .into_iter()
            .map(|(user_id, contact)| (user_id.as_slice()[0], contact.nickname.unwrap()))
            .collect()
    }

    fn owned(nicknames: &[(u8, &str)]) -> Vec<(u8, String)> {
        nicknames.iter().map(|(i, n)| (*i, n.to_string())).collect()
    }

    fn set_nickname(i: u8, nickname: &str) -> OptionalContact {
        OptionalContact {
            user_id: user_id(i),
            nickname: OptionUpdate::SetToSome(nickname.to_string()),
        }
    }

    fn remove_nickname(i: u8) -> OptionalContact {
        OptionalContact {
            user_id: user_id(i),
            nickname: OptionUpdate::SetToNone,
        }
    }

    fn user_id(i: u8) -> UserId {
        Principal::from_slice(&[i; 10]).into()
    }

    fn init_stable_memory_map() {
        let memory = MemoryManager::init(DefaultMemoryImpl::default());
        stable_memory_map::init_with_small_entries_map(memory.get(MemoryId::new(1)), memory.get(MemoryId::new(2)));
    }
}
