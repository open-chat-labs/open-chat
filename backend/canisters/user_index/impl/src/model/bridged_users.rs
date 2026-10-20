use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use types::{BridgedUser, BridgedUserId, BridgedUserSummary, TimestampMillis};

// The latest profile of each account on another platform, eg. Discord, which a bridge bot has relayed
// a message from. Relayed messages hold only the account's id, so clients render them from this.
#[derive(Serialize, Deserialize, Default)]
pub struct BridgedUsers {
    users: HashMap<BridgedUserId, BridgedUserRecord>,
}

#[derive(Serialize, Deserialize)]
struct BridgedUserRecord {
    #[serde(rename = "u")]
    user: BridgedUser,
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
                self.users.insert(user.id(), BridgedUserRecord { user, updated: now });
                true
            }
        }
    }

    pub fn get(&self, id: &BridgedUserId) -> Option<BridgedUserSummary> {
        self.users.get(id).map(|record| BridgedUserSummary {
            user: record.user.clone(),
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
                updated: 3
            }
        );
        assert_eq!(users.len(), 1);
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
