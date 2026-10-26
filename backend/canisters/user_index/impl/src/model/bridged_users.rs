use constants::MINUTE_IN_MS;
use serde::{Deserialize, Serialize};
use std::collections::{BTreeMap, HashMap, HashSet};
use types::{BridgePlatform, BridgedUser, BridgedUserId, BridgedUserSummary, Milliseconds, TimestampMillis, UserId};

pub const LINK_CODE_EXPIRY: Milliseconds = 10 * MINUTE_IN_MS;

// The latest profile of each account on another platform, eg. Discord, which a bridge bot has relayed
// a message from, and the OpenChat user who has linked it, if any. Relayed messages hold only the
// account's id, so clients render them from this.
#[derive(Serialize, Deserialize, Default)]
pub struct BridgedUsers {
    users: HashMap<BridgedUserId, BridgedUserRecord>,
    // The codes users have been given to link an account, which the platform's bridge bot redeems
    // once it knows whose account it is
    #[serde(default)]
    pending_links: HashMap<String, PendingLink>,
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

#[derive(Serialize, Deserialize)]
struct PendingLink {
    #[serde(rename = "u")]
    user_id: UserId,
    #[serde(rename = "p")]
    platform: BridgePlatform,
    #[serde(rename = "e")]
    expires: TimestampMillis,
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

    // Any code the user was given earlier for the platform stops working. Returns when this one
    // expires.
    pub fn start_link(
        &mut self,
        user_id: UserId,
        platform: BridgePlatform,
        code: String,
        now: TimestampMillis,
    ) -> TimestampMillis {
        self.pending_links
            .retain(|_, link| link.expires > now && (link.user_id != user_id || link.platform != platform));

        let expires = now + LINK_CODE_EXPIRY;
        self.pending_links.insert(
            code,
            PendingLink {
                user_id,
                platform,
                expires,
            },
        );
        expires
    }

    // Links the account to the user who was given the code, which can only be used once, and only
    // for an account on the platform it was given for. A link replaces any earlier one. Only an
    // account which is new to the registry has its profile stored here: a known one's is left to the
    // messages it relays, which carry the latest. Returns the user, or None if the code is unknown or
    // has expired.
    pub fn link(&mut self, user: BridgedUser, code: &str, now: TimestampMillis) -> Option<UserId> {
        let user_id = self
            .pending_links
            .get(code)
            .filter(|link| link.platform == user.platform() && link.expires > now)?
            .user_id;
        self.pending_links.remove(code);

        match self.users.get_mut(&user.id()) {
            Some(record) if record.linked_user_id == Some(user_id) => {}
            Some(record) => {
                record.linked_user_id = Some(user_id);
                record.updated = now;
            }
            None => {
                self.users.insert(
                    user.id(),
                    BridgedUserRecord {
                        user,
                        linked_user_id: Some(user_id),
                        updated: now,
                    },
                );
            }
        }
        Some(user_id)
    }

    // Unlinks the account from the given user, or with None, from whoever it's linked to. Returns
    // whether it was unlinked.
    pub fn unlink(&mut self, id: &BridgedUserId, from: Option<UserId>, now: TimestampMillis) -> bool {
        let Some(record) = self.users.get_mut(id) else {
            return false;
        };
        if record.linked_user_id.is_none() || from.is_some_and(|user_id| record.linked_user_id != Some(user_id)) {
            return false;
        }
        record.linked_user_id = None;
        record.updated = now;
        true
    }

    // For when the user is deleted: their accounts are unlinked, and their codes stop working.
    // Returns the accounts which were unlinked.
    pub fn remove_user(&mut self, user_id: UserId, now: TimestampMillis) -> Vec<BridgedUserId> {
        self.pending_links.retain(|_, link| link.user_id != user_id);
        let mut unlinked = Vec::new();
        for (id, record) in self
            .users
            .iter_mut()
            .filter(|(_, record)| record.linked_user_id == Some(user_id))
        {
            record.linked_user_id = None;
            record.updated = now;
            unlinked.push(*id);
        }
        unlinked
    }

    // Each linked account and who it's linked to
    pub fn links(&self) -> impl Iterator<Item = (BridgedUserId, UserId)> + '_ {
        self.users
            .iter()
            .filter_map(|(id, record)| record.linked_user_id.map(|user_id| (*id, user_id)))
    }

    pub fn get(&self, id: &BridgedUserId) -> Option<BridgedUserSummary> {
        self.users.get(id).map(|record| record.summary())
    }

    pub fn linked_user_id(&self, id: &BridgedUserId) -> Option<UserId> {
        self.users.get(id).and_then(|record| record.linked_user_id)
    }

    // The registry is small enough to scan, rather than keep an index of who linked what
    pub fn linked_to(&self, user_id: UserId) -> Vec<BridgedUserSummary> {
        self.users
            .values()
            .filter(|record| record.linked_user_id == Some(user_id))
            .map(|record| record.summary())
            .collect()
    }

    pub fn len(&self) -> usize {
        self.users.len()
    }

    // The registry is small enough to scan for these, rather than keep counts
    pub fn metrics(&self) -> BridgedUserMetrics {
        let mut metrics = BridgedUserMetrics::default();
        let mut linked_users = HashSet::new();
        for (id, record) in self.users.iter() {
            let platform = metrics.platforms.entry(id.platform()).or_default();
            platform.accounts += 1;
            if let Some(user_id) = record.linked_user_id {
                platform.linked_accounts += 1;
                linked_users.insert(user_id);
            }
        }
        metrics.linked_users = linked_users.len();
        metrics
    }
}

impl BridgedUserRecord {
    fn summary(&self) -> BridgedUserSummary {
        BridgedUserSummary {
            user: self.user.clone(),
            linked_user_id: self.linked_user_id,
            updated: self.updated,
        }
    }
}

#[derive(Serialize, Debug, Default, PartialEq, Eq)]
pub struct BridgedUserMetrics {
    // Only the platforms with an account in the registry
    pub platforms: BTreeMap<BridgePlatform, BridgedPlatformMetrics>,
    // The users who have linked an account on any platform, which is lower than the total of the
    // links where a user has linked more than one
    pub linked_users: usize,
}

#[derive(Serialize, Debug, Default, PartialEq, Eq)]
pub struct BridgedPlatformMetrics {
    // Including those no one can link, eg. Discord webhooks
    pub accounts: usize,
    pub linked_accounts: usize,
}

#[cfg(test)]
mod tests {
    use super::*;
    use candid::Principal;
    use types::{DiscordUser, TelegramUser};

    fn discord_user(display_name: &str) -> BridgedUser {
        BridgedUser::Discord(DiscordUser {
            id: 80351110224678912,
            username: "nelly".to_string(),
            display_name: Some(display_name.to_string()),
            avatar: None,
            bot: false,
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

    fn telegram_user() -> BridgedUser {
        BridgedUser::Telegram(TelegramUser {
            id: 123456789,
            username: Some("nelly".to_string()),
            display_name: "Nelly".to_string(),
            photo_id: None,
        })
    }

    #[test]
    fn a_code_links_the_account_once() {
        let mut users = BridgedUsers::default();
        let id = BridgedUserId::Discord(80351110224678912);
        let alice: UserId = Principal::from_slice(&[1]).into();

        let expires = users.start_link(alice, BridgePlatform::Discord, "code".to_string(), 1);
        assert_eq!(expires, 1 + LINK_CODE_EXPIRY);

        assert_eq!(users.link(discord_user("Nelly"), "wrong", 2), None);
        assert_eq!(users.link(discord_user("Nelly"), "code", 2), Some(alice));
        assert_eq!(users.get(&id).unwrap().linked_user_id, Some(alice));
        assert_eq!(users.linked_to(alice), vec![users.get(&id).unwrap()]);

        // It can't be used again
        assert_eq!(users.link(discord_user("Nelly"), "code", 3), None);
    }

    #[test]
    fn a_code_expires() {
        let mut users = BridgedUsers::default();
        let alice: UserId = Principal::from_slice(&[1]).into();

        users.start_link(alice, BridgePlatform::Discord, "code".to_string(), 1);

        assert_eq!(users.link(discord_user("Nelly"), "code", 1 + LINK_CODE_EXPIRY), None);
        assert!(users.get(&BridgedUserId::Discord(80351110224678912)).is_none());
    }

    // So one bridge bot can't use up a code given for another's platform
    #[test]
    fn a_code_only_links_an_account_on_its_platform() {
        let mut users = BridgedUsers::default();
        let alice: UserId = Principal::from_slice(&[1]).into();

        users.start_link(alice, BridgePlatform::Discord, "code".to_string(), 1);

        assert_eq!(users.link(telegram_user(), "code", 2), None);
        assert_eq!(users.link(discord_user("Nelly"), "code", 2), Some(alice));
    }

    #[test]
    fn a_new_code_replaces_the_users_earlier_one_for_the_platform() {
        let mut users = BridgedUsers::default();
        let alice: UserId = Principal::from_slice(&[1]).into();
        let bob: UserId = Principal::from_slice(&[2]).into();

        users.start_link(alice, BridgePlatform::Discord, "first".to_string(), 1);
        users.start_link(alice, BridgePlatform::Telegram, "telegram".to_string(), 1);
        users.start_link(bob, BridgePlatform::Discord, "bob".to_string(), 1);
        users.start_link(alice, BridgePlatform::Discord, "second".to_string(), 2);

        assert_eq!(users.link(discord_user("Nelly"), "first", 3), None);
        assert_eq!(users.link(discord_user("Nelly"), "second", 3), Some(alice));
        assert_eq!(users.link(telegram_user(), "telegram", 3), Some(alice));
        assert_eq!(users.link(discord_user("Nelly"), "bob", 3), Some(bob));
    }

    #[test]
    fn linking_and_unlinking() {
        let mut users = BridgedUsers::default();
        let id = BridgedUserId::Discord(80351110224678912);
        let alice: UserId = Principal::from_slice(&[1]).into();
        let bob: UserId = Principal::from_slice(&[2]).into();
        let linked_user_id = |users: &BridgedUsers| users.get(&id).unwrap().linked_user_id;

        // Unlinking an account which hasn't relayed a message changes nothing
        assert!(!users.unlink(&id, Some(alice), 1));
        assert!(!users.unlink(&id, None, 1));

        users.start_link(alice, BridgePlatform::Discord, "alice".to_string(), 1);
        users.link(discord_user("Nelly"), "alice", 1);
        assert_eq!(linked_user_id(&users), Some(alice));

        // Someone else unlinking it changes nothing
        assert!(!users.unlink(&id, Some(bob), 2));
        assert_eq!(linked_user_id(&users), Some(alice));

        // A new link replaces the old one
        users.start_link(bob, BridgePlatform::Discord, "bob".to_string(), 3);
        users.link(discord_user("Nelly"), "bob", 3);
        assert_eq!(linked_user_id(&users), Some(bob));
        assert!(users.linked_to(alice).is_empty());

        assert!(users.unlink(&id, Some(bob), 4));
        assert_eq!(linked_user_id(&users), None);
        assert_eq!(users.get(&id).unwrap().updated, 4);
        assert!(!users.unlink(&id, Some(bob), 5));

        // The account's owner can unlink it from whoever it's linked to
        users.start_link(alice, BridgePlatform::Discord, "alice".to_string(), 6);
        users.link(discord_user("Nelly"), "alice", 6);
        assert!(users.unlink(&id, None, 7));
        assert_eq!(linked_user_id(&users), None);
    }

    #[test]
    fn removing_a_user_unlinks_their_accounts_and_drops_their_codes() {
        let mut users = BridgedUsers::default();
        let id = BridgedUserId::Discord(80351110224678912);
        let alice: UserId = Principal::from_slice(&[1]).into();
        let bob: UserId = Principal::from_slice(&[2]).into();

        users.start_link(alice, BridgePlatform::Discord, "discord".to_string(), 1);
        users.link(discord_user("Nelly"), "discord", 1);
        users.start_link(alice, BridgePlatform::Telegram, "telegram".to_string(), 1);
        users.start_link(bob, BridgePlatform::Telegram, "bob".to_string(), 1);

        // So the LocalUserIndexes can be told
        assert_eq!(users.remove_user(alice, 2), [id]);

        let summary = users.get(&id).unwrap();
        assert_eq!(summary.linked_user_id, None);
        assert_eq!(summary.updated, 2);
        assert_eq!(users.link(telegram_user(), "telegram", 3), None);
        assert_eq!(users.link(telegram_user(), "bob", 3), Some(bob));
    }

    // As the LocalUserIndexes are given them
    #[test]
    fn links_lists_each_linked_account() {
        let mut users = BridgedUsers::default();
        let alice: UserId = Principal::from_slice(&[1]).into();
        let bob: UserId = Principal::from_slice(&[2]).into();

        users.start_link(alice, BridgePlatform::Discord, "alice".to_string(), 1);
        users.link(discord_user("Nelly"), "alice", 1);
        users.start_link(bob, BridgePlatform::Telegram, "bob".to_string(), 1);
        users.link(telegram_user(), "bob", 1);
        // Known, but not linked
        users.update(
            BridgedUser::Telegram(TelegramUser {
                id: 987654321,
                username: None,
                display_name: "Sam".to_string(),
                photo_id: None,
            }),
            1,
        );

        let mut links: Vec<_> = users.links().collect();
        links.sort();
        assert_eq!(
            links,
            [
                (BridgedUserId::Discord(80351110224678912), alice),
                (BridgedUserId::Telegram(123456789), bob)
            ]
        );

        users.unlink(&BridgedUserId::Telegram(123456789), None, 2);
        assert_eq!(
            users.links().collect::<Vec<_>>(),
            [(BridgedUserId::Discord(80351110224678912), alice)]
        );
    }

    #[test]
    fn metrics_count_the_accounts_and_links_on_each_platform() {
        let mut users = BridgedUsers::default();
        let alice: UserId = Principal::from_slice(&[1]).into();
        let bob: UserId = Principal::from_slice(&[2]).into();
        let carol: UserId = Principal::from_slice(&[3]).into();
        let telegram_user_with_id = |id: i64| {
            BridgedUser::Telegram(TelegramUser {
                id,
                username: None,
                display_name: "Sam".to_string(),
                photo_id: None,
            })
        };
        assert_eq!(users.metrics(), BridgedUserMetrics::default());

        // Alice links an account on both Discord and Telegram
        users.start_link(alice, BridgePlatform::Discord, "discord".to_string(), 1);
        users.link(discord_user("Nelly"), "discord", 1);
        users.start_link(alice, BridgePlatform::Telegram, "telegram".to_string(), 1);
        users.link(telegram_user(), "telegram", 1);
        users.start_link(bob, BridgePlatform::Telegram, "bob".to_string(), 1);
        users.link(telegram_user_with_id(987654321), "bob", 1);
        // Known, but not linked
        users.update(telegram_user_with_id(555555555), 1);
        // Carol unlinks hers, so she's no longer counted
        users.start_link(carol, BridgePlatform::Telegram, "carol".to_string(), 1);
        users.link(telegram_user_with_id(444444444), "carol", 1);
        users.unlink(&BridgedUserId::Telegram(444444444), None, 2);

        assert_eq!(
            users.metrics(),
            BridgedUserMetrics {
                platforms: BTreeMap::from([
                    (
                        BridgePlatform::Discord,
                        BridgedPlatformMetrics {
                            accounts: 1,
                            linked_accounts: 1
                        }
                    ),
                    (
                        BridgePlatform::Telegram,
                        BridgedPlatformMetrics {
                            accounts: 4,
                            linked_accounts: 2
                        }
                    ),
                ]),
                linked_users: 2,
            }
        );
    }

    // The profile is left to the messages the account relays, which carry the latest
    #[test]
    fn linking_leaves_a_known_accounts_profile() {
        let mut users = BridgedUsers::default();
        let alice: UserId = Principal::from_slice(&[1]).into();
        users.update(discord_user("Nelly Smith"), 1);

        users.start_link(alice, BridgePlatform::Discord, "code".to_string(), 2);
        users.link(discord_user("Nelly"), "code", 2);

        let summary = users.get(&BridgedUserId::Discord(80351110224678912)).unwrap();
        assert_eq!(summary.user, discord_user("Nelly Smith"));
        assert_eq!(summary.linked_user_id, Some(alice));
    }

    // It's kept in the canister's state, which is msgpack, with the accounts' ids as map keys
    #[test]
    fn survives_serialization() {
        let mut users = BridgedUsers::default();
        let alice: UserId = Principal::from_slice(&[1]).into();
        users.update(discord_user("Nelly"), 1);
        users.start_link(alice, BridgePlatform::Discord, "nelly".to_string(), 1);
        users.link(discord_user("Nelly"), "nelly", 1);
        users.start_link(alice, BridgePlatform::Telegram, "pending".to_string(), 1);

        let bytes = msgpack::serialize_then_unwrap(&users);
        let mut users: BridgedUsers = msgpack::deserialize_then_unwrap(&bytes);

        let summary = users.get(&BridgedUserId::Discord(80351110224678912)).unwrap();
        assert_eq!(summary.user, discord_user("Nelly"));
        assert_eq!(summary.linked_user_id, Some(alice));
        assert_eq!(users.link(telegram_user(), "pending", 2), Some(alice));
    }
}
