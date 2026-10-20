use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use types::{BridgedUser, BridgedUserId, BridgedUserSummary, TimestampMillis, UserId};

// The latest profile of each account on another platform, eg. Discord, which a bridge bot has relayed
// a message from, and the OpenChat user who has linked it, if any. Relayed messages hold only the
// account's id, so clients render them from this.
#[derive(Serialize, Deserialize, Default)]
pub struct BridgedUsers {
    users: HashMap<BridgedUserId, BridgedUserRecord>,
}

#[derive(Serialize, Deserialize)]
struct BridgedUserRecord {
    #[serde(rename = "u")]
    user: BridgedUser,
    #[serde(rename = "l", default, skip_serializing_if = "Option::is_none")]
    linked_user_id: Option<UserId>,
    #[serde(rename = "t")]
    updated: TimestampMillis,
}

impl BridgedUsers {
    // Returns whether the profile changed
    pub fn update(&mut self, user: BridgedUser, now: TimestampMillis) -> bool {
        match self.users.get_mut(&user.id()) {
            Some(record) if record.user == user => false,
            Some(record) => {
                record.user = user;
                record.updated = now;
                true
            }
            None => {
                self.users.insert(
                    user.id(),
                    BridgedUserRecord {
                        user,
                        linked_user_id: None,
                        updated: now,
                    },
                );
                true
            }
        }
    }

    // Links the account to `user_id`, replacing any earlier link, or unlinks it if it's linked to
    // them. Returns whether anything changed.
    pub fn set_link(&mut self, user: BridgedUser, user_id: UserId, linked: bool, now: TimestampMillis) -> bool {
        let id = user.id();
        let mut changed = self.update(user, now);
        if let Some(record) = self.users.get_mut(&id) {
            let link = if linked {
                Some(user_id)
            } else if record.linked_user_id == Some(user_id) {
                None
            } else {
                record.linked_user_id
            };
            if record.linked_user_id != link {
                record.linked_user_id = link;
                record.updated = now;
                changed = true;
            }
        }
        changed
    }

    pub fn get(&self, id: &BridgedUserId) -> Option<BridgedUserSummary> {
        self.users.get(id).map(|record| BridgedUserSummary {
            user: record.user.clone(),
            linked_user_id: record.linked_user_id,
            updated: record.updated,
        })
    }

    pub fn len(&self) -> usize {
        self.users.len()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use candid::Principal;
    use types::DiscordUser;

    fn discord_user(display_name: &str) -> BridgedUser {
        BridgedUser::Discord(DiscordUser {
            id: 80351110224678912,
            username: "nelly".to_string(),
            display_name: Some(display_name.to_string()),
            avatar: None,
        })
    }

    #[test]
    fn update_only_changes_the_timestamp_when_the_profile_changes() {
        let mut users = BridgedUsers::default();
        let id = BridgedUserId::Discord(80351110224678912);

        assert!(users.update(discord_user("Nelly"), 1));
        assert!(!users.update(discord_user("Nelly"), 2));
        assert_eq!(users.get(&id).unwrap().updated, 1);

        assert!(users.update(discord_user("Nelly Smith"), 3));
        assert_eq!(
            users.get(&id).unwrap(),
            BridgedUserSummary {
                user: discord_user("Nelly Smith"),
                linked_user_id: None,
                updated: 3
            }
        );
        assert_eq!(users.len(), 1);
    }

    #[test]
    fn linking_and_unlinking() {
        let mut users = BridgedUsers::default();
        let id = BridgedUserId::Discord(80351110224678912);
        let alice: UserId = Principal::from_slice(&[1]).into();
        let bob: UserId = Principal::from_slice(&[2]).into();

        // Linking an account which hasn't relayed a message yet adds its profile too
        assert!(users.set_link(discord_user("Nelly"), alice, true, 1));
        assert_eq!(users.get(&id).unwrap().linked_user_id, Some(alice));
        assert!(!users.set_link(discord_user("Nelly"), alice, true, 2));
        assert_eq!(users.get(&id).unwrap().updated, 1);

        // Someone else unlinking it changes nothing
        assert!(!users.set_link(discord_user("Nelly"), bob, false, 3));
        assert_eq!(users.get(&id).unwrap().linked_user_id, Some(alice));

        // A new link replaces the old one
        assert!(users.set_link(discord_user("Nelly"), bob, true, 4));
        assert_eq!(users.get(&id).unwrap().linked_user_id, Some(bob));

        assert!(users.set_link(discord_user("Nelly"), bob, false, 5));
        assert_eq!(users.get(&id).unwrap().linked_user_id, None);
        assert_eq!(users.get(&id).unwrap().updated, 5);
    }

    // It's kept in the canister's state, which is msgpack, with the accounts' ids as map keys
    #[test]
    fn survives_serialization() {
        let mut users = BridgedUsers::default();
        users.update(discord_user("Nelly"), 1);

        let bytes = msgpack::serialize_then_unwrap(&users);
        let users: BridgedUsers = msgpack::deserialize_then_unwrap(&bytes);

        assert_eq!(
            users.get(&BridgedUserId::Discord(80351110224678912)).unwrap().user,
            discord_user("Nelly")
        );
    }
}
