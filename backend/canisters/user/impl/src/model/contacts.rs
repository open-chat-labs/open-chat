use candid::Principal;
use serde::{Deserialize, Serialize};
use stable_memory_map::{ContactKey, ContactKeyPrefix, KeyPrefix, with_map, with_map_mut};
use std::collections::HashMap;
use std::ops::RangeInclusive;
use types::{FieldTooLongResult, FieldTooShortResult, OptionUpdate, UserId};
use user_canister::set_contact::OptionalContact;

const MAX_NICKNAME_LEN: u32 = 32;
const MIN_NICKNAME_LEN: u32 = 2;

// The user's contacts, stored in the main stable memory map keyed by user id
#[derive(Serialize, Deserialize, Default)]
pub struct Contacts {
    // The contacts which were held on the heap, which are all moved into stable memory in
    // `post_upgrade` by `migrate_to_stable_memory`, so this is always empty otherwise.
    // TODO: Remove this after next release
    #[serde(rename = "map", default, skip_serializing)]
    on_heap: HashMap<UserId, Contact>,
}

// Each contact is serialized into stable memory, so its field names are kept short
#[derive(Serialize, Deserialize, Clone, Debug, Default, PartialEq, Eq)]
pub struct Contact {
    // The alias is the field's name when the contacts were held on the heap
    // TODO: Remove the alias after next release
    #[serde(rename = "n", alias = "nickname", default, skip_serializing_if = "Option::is_none")]
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
                    let mut value = m.get(key.clone()).map(|bytes| contact_from_bytes(&bytes)).unwrap_or_default();
                    value.nickname = Some(nickname);
                    m.insert(key, contact_to_bytes(&value));
                });

                SetContactResponse::Success
            }
        }
    }

    // Returns every contact, ordered by user id
    pub fn all(&self) -> Vec<(UserId, Contact)> {
        with_map(|m| {
            m.range(all_keys())
                .map(|(key, bytes)| (key.user_id(), contact_from_bytes(&bytes)))
                .collect()
        })
    }

    // Moves the contacts which were held on the heap into stable memory, returning how many were
    // moved
    // TODO: Remove this after next release
    pub fn migrate_to_stable_memory(&mut self) -> usize {
        if self.on_heap.is_empty() {
            return 0;
        }

        let prefix = ContactKeyPrefix::new();
        let mut entries: Vec<_> = std::mem::take(&mut self.on_heap)
            .into_iter()
            .map(|(user_id, contact)| (prefix.create_key(&user_id), contact_to_bytes(&contact)))
            .collect();
        // Insert the entries in key order
        entries.sort_unstable_by(|(a, _), (b, _)| a.cmp(b));

        let count = entries.len();
        with_map_mut(|m| m.insert_many(entries));
        count
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

    #[test]
    fn contacts_on_heap_are_migrated_to_stable_memory() {
        init_stable_memory_map();

        // Contacts serialized by the previous version, whose field names were in full
        #[derive(Serialize)]
        struct PreviousContacts {
            map: HashMap<UserId, PreviousContact>,
        }
        #[derive(Serialize)]
        struct PreviousContact {
            nickname: Option<String>,
        }
        let previous = PreviousContacts {
            map: (1..=50)
                .map(|i| {
                    (
                        user_id(i),
                        PreviousContact {
                            nickname: Some(format!("nickname{i}")),
                        },
                    )
                })
                .collect(),
        };
        let mut contacts: Contacts = msgpack::deserialize_then_unwrap(&msgpack::serialize_then_unwrap(&previous));

        assert_eq!(contacts.migrate_to_stable_memory(), 50);
        assert!(contacts.on_heap.is_empty());
        assert_eq!(contacts.migrate_to_stable_memory(), 0);

        let all = contacts.all();
        assert_eq!(all.len(), 50);
        for (user_id, contact) in all {
            let i = user_id.as_slice()[0];
            assert_eq!(contact.nickname, Some(format!("nickname{i}")));
        }

        // Migrated contacts can be updated
        assert!(matches!(
            contacts.set_contact(set_nickname(20, "updated")),
            SetContactResponse::Success
        ));
        assert!(contacts.all().contains(&(
            user_id(20),
            Contact {
                nickname: Some("updated".to_string())
            }
        )));

        // The heap isn't serialized
        let deserialized: Contacts = msgpack::deserialize_then_unwrap(&msgpack::serialize_then_unwrap(&contacts));
        assert!(deserialized.on_heap.is_empty());
        assert_eq!(deserialized.all().len(), 50);
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
