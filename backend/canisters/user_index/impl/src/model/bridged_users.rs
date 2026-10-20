use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use types::{BridgedUser, BridgedUserId, BridgedUserSummary, TimestampMillis, UserId};
use user_index_canister::BridgedUserLinkChange;

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

    // A link replaces any earlier one. Only an account which is new to the registry has its profile
    // stored here: a known one's is left to the messages it relays, which carry the latest. Returns
    // whether anything changed.
    pub fn set_link(&mut self, user: BridgedUser, change: BridgedUserLinkChange, now: TimestampMillis) -> bool {
        let Some(record) = self.users.get_mut(&user.id()) else {
            let BridgedUserLinkChange::Linked(user_id) = change else {
                return false;
            };
            self.users.insert(
                user.id(),
                BridgedUserRecord {
                    user,
                    linked_user_id: Some(user_id),
                    updated: now,
                },
            );
            return true;
        };

        let link = match change {
            BridgedUserLinkChange::Linked(user_id) => Some(user_id),
            BridgedUserLinkChange::Unlinked(user_id) if record.linked_user_id == Some(user_id) => None,
            BridgedUserLinkChange::Unlinked(_) => record.linked_user_id,
            BridgedUserLinkChange::UnlinkedByAccount => None,
        };
        if record.linked_user_id == link {
            return false;
        }
        record.linked_user_id = link;
        record.updated = now;
        true
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
        let linked_user_id = |users: &BridgedUsers| users.get(&id).unwrap().linked_user_id;

        // Unlinking an account which hasn't relayed a message changes nothing, but linking it adds
        // its profile too
        assert!(!users.set_link(discord_user("Nelly"), BridgedUserLinkChange::Unlinked(alice), 1));
        assert!(users.get(&id).is_none());
        assert!(users.set_link(discord_user("Nelly"), BridgedUserLinkChange::Linked(alice), 1));
        assert_eq!(linked_user_id(&users), Some(alice));
        assert!(!users.set_link(discord_user("Nelly"), BridgedUserLinkChange::Linked(alice), 2));
        assert_eq!(users.get(&id).unwrap().updated, 1);

        // Someone else unlinking it changes nothing
        assert!(!users.set_link(discord_user("Nelly"), BridgedUserLinkChange::Unlinked(bob), 3));
        assert_eq!(linked_user_id(&users), Some(alice));

        // A new link replaces the old one
        assert!(users.set_link(discord_user("Nelly"), BridgedUserLinkChange::Linked(bob), 4));
        assert_eq!(linked_user_id(&users), Some(bob));

        assert!(users.set_link(discord_user("Nelly"), BridgedUserLinkChange::Unlinked(bob), 5));
        assert_eq!(linked_user_id(&users), None);
        assert_eq!(users.get(&id).unwrap().updated, 5);

        // The account's owner can unlink it from whoever it's linked to
        users.set_link(discord_user("Nelly"), BridgedUserLinkChange::Linked(alice), 6);
        assert!(users.set_link(discord_user("Nelly"), BridgedUserLinkChange::UnlinkedByAccount, 7));
        assert_eq!(linked_user_id(&users), None);
    }

    // The profile is left to the messages the account relays, which carry the latest
    #[test]
    fn linking_leaves_a_known_accounts_profile() {
        let mut users = BridgedUsers::default();
        let alice: UserId = Principal::from_slice(&[1]).into();
        users.update(discord_user("Nelly Smith"), 1);

        users.set_link(discord_user("Nelly"), BridgedUserLinkChange::Linked(alice), 2);

        let summary = users.get(&BridgedUserId::Discord(80351110224678912)).unwrap();
        assert_eq!(summary.user, discord_user("Nelly Smith"));
        assert_eq!(summary.linked_user_id, Some(alice));
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
