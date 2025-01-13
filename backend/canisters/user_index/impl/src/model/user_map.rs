use super::user::SuspensionDetails;
use crate::model::diamond_membership_details::DiamondMembershipDetailsInternal;
use crate::model::user::User;
use crate::DiamondMembershipUserMetrics;
use candid::Principal;
use search::weighted::{Document as SearchDocument, Query};
use serde::{Deserialize, Serialize};
use std::collections::{BTreeMap, BTreeSet, HashMap};
use std::ops::RangeFrom;
use tracing::info;
use types::{
    BotMatch, CyclesTopUp, Document, Milliseconds, SlashCommandSchema, SuspensionDuration, TimestampMillis, UniquePersonProof,
    UserId, UserType,
};
use utils::case_insensitive_hash_map::CaseInsensitiveHashMap;
use utils::time::MonthKey;

#[derive(Serialize, Deserialize, Default)]
#[serde(from = "UserMapTrimmed")]
pub struct UserMap {
    users: HashMap<UserId, User>,
    #[serde(default)]
    bots: HashMap<UserId, Bot>,
    suspected_bots: BTreeSet<UserId>,
    deleted_users: HashMap<UserId, TimestampMillis>,
    suspended_or_unsuspended_users: BTreeSet<(TimestampMillis, UserId)>,
    unique_person_proofs_submitted: u32,

    #[serde(skip)]
    username_to_user_id: CaseInsensitiveHashMap<UserId>,
    #[serde(skip)]
    botname_to_user_id: CaseInsensitiveHashMap<UserId>,
    #[serde(skip)]
    principal_to_user_id: HashMap<Principal, UserId>,
    #[serde(skip)]
    user_referrals: HashMap<UserId, Vec<UserId>>,
    #[serde(skip)]
    pub users_with_duplicate_usernames: Vec<(UserId, UserId)>,
    #[serde(skip)]
    pub users_with_duplicate_principals: Vec<(UserId, UserId)>,
}

#[derive(Serialize, Deserialize, Clone)]
pub struct Bot {
    pub name: String,
    pub avatar: Option<Document>,
    pub owner: UserId,
    pub endpoint: String,
    pub description: String,
    pub commands: Vec<SlashCommandSchema>,
    pub last_updated: TimestampMillis,
}

impl Bot {
    pub fn to_match(&self, id: UserId, score: u32) -> BotMatch {
        BotMatch {
            id,
            score,
            owner: self.owner,
            name: self.name.clone(),
            description: self.description.clone(),
            avatar_id: self.avatar.as_ref().map(|a| a.id),
            commands: self.commands.clone(),
        }
    }
}

impl UserMap {
    pub fn does_username_exist(&self, username: &str, is_bot: bool) -> bool {
        let map = if is_bot { &self.botname_to_user_id } else { &self.username_to_user_id };
        map.contains_key(username)
    }

    pub fn ensure_unique_username(&self, username: &str, is_bot: bool) -> Result<(), String> {
        if !self.does_username_exist(username, is_bot) {
            return Ok(());
        }

        // Append the lowest number (starting from 2) which will make this username unique
        let mut suffix = 2;
        loop {
            let u = format!("{username}{suffix}");
            if !self.username_to_user_id.contains_key(&u) {
                return Err(u);
            }
            suffix += 1;
        }
    }

    #[allow(clippy::too_many_arguments)]
    pub fn register(
        &mut self,
        principal: Principal,
        user_id: UserId,
        username: String,
        display_name: Option<String>,
        now: TimestampMillis,
        referred_by: Option<UserId>,
        user_type: UserType,
        bot: Option<Bot>,
    ) {
        if bot.is_some() {
            self.botname_to_user_id.insert(&username, user_id);
        } else {
            self.username_to_user_id.insert(&username, user_id);
        }

        let avatar_id = bot.as_ref().and_then(|b| b.avatar.as_ref().map(|a| a.id));

        self.principal_to_user_id.insert(principal, user_id);

        let user = User::new(
            principal,
            user_id,
            username,
            display_name,
            now,
            referred_by,
            user_type,
            avatar_id,
        );

        self.users.insert(user_id, user);

        if let Some(bot) = bot {
            self.bots.insert(user_id, bot);
        }

        if let Some(ref_by) = referred_by {
            self.user_referrals.entry(ref_by).or_default().push(user_id);
        }
    }

    pub fn update(
        &mut self,
        mut user: User,
        now: TimestampMillis,
        ignore_principal_clash: bool,
        bot: Option<Bot>,
    ) -> UpdateUserResult {
        let user_id = user.user_id;

        if let Some(previous) = self.users.get(&user_id) {
            let previous_principal = previous.principal;
            let principal = user.principal;
            let principal_changed = previous_principal != principal;

            let previous_username = &previous.username;
            let username = &user.username;
            let username_case_insensitive_changed = previous_username.to_uppercase() != username.to_uppercase();

            if principal_changed {
                if let Some(other) = self.principal_to_user_id.get(&principal) {
                    if !ignore_principal_clash {
                        return UpdateUserResult::PrincipalTaken;
                    }
                    info!(user_id1 = %user_id, user_id2 = %other, "Principal clash");
                }
            }

            if username_case_insensitive_changed && self.does_username_exist(username, bot.is_some()) {
                return UpdateUserResult::UsernameTaken;
            }

            // Checks are complete, now update the data

            user.date_updated = now;

            if principal_changed {
                self.principal_to_user_id.remove(&previous_principal);
                self.principal_to_user_id.insert(principal, user_id);
            }

            if username_case_insensitive_changed {
                if bot.is_some() {
                    self.botname_to_user_id.remove(previous_username);
                    self.botname_to_user_id.insert(username, user_id);
                } else {
                    self.username_to_user_id.remove(previous_username);
                    self.username_to_user_id.insert(username, user_id);
                }
            }

            if previous.display_name != user.display_name {
                user.display_name_upper = user.display_name.as_ref().map(|s| s.to_uppercase());
            }

            self.users.insert(user_id, user);

            if let Some(bot) = bot {
                self.bots.insert(user_id, bot);
            }

            UpdateUserResult::Success
        } else {
            UpdateUserResult::UserNotFound
        }
    }

    pub fn get(&self, user_id_or_principal: &Principal) -> Option<&User> {
        let user_id = self
            .principal_to_user_id
            .get(user_id_or_principal)
            .copied()
            .unwrap_or_else(|| UserId::from(*user_id_or_principal));

        self.users.get(&user_id)
    }

    pub fn get_by_principal(&self, principal: &Principal) -> Option<&User> {
        self.principal_to_user_id.get(principal).and_then(|u| self.users.get(u))
    }

    pub fn get_by_user_id(&self, user_id: &UserId) -> Option<&User> {
        self.users.get(user_id)
    }

    pub fn get_by_username(&self, username: &str) -> Option<&User> {
        self.username_to_user_id.get(username).and_then(|u| self.users.get(u))
    }

    pub fn get_bot(&self, user_id: &UserId) -> Option<&Bot> {
        self.bots.get(user_id)
    }

    pub fn delete_user(&mut self, user_id: UserId, now: TimestampMillis) -> Option<User> {
        let user = self.users.remove(&user_id)?;
        if self.principal_to_user_id.get(&user.principal) == Some(&user_id) {
            self.principal_to_user_id.remove(&user.principal);
        }
        if self.username_to_user_id.get(&user.username) == Some(&user_id) {
            self.username_to_user_id.remove(&user.username);
        }
        self.deleted_users.insert(user_id, now);
        Some(user)
    }

    pub fn is_deleted(&self, user_id: &UserId) -> bool {
        self.deleted_users.contains_key(user_id) && !self.users.contains_key(user_id)
    }

    pub fn diamond_membership_details_mut(&mut self, user_id: &UserId) -> Option<&mut DiamondMembershipDetailsInternal> {
        self.users.get_mut(user_id).map(|u| &mut u.diamond_membership_details)
    }

    pub fn mark_updated(&mut self, user_id: &UserId, now: TimestampMillis) {
        if let Some(user) = self.users.get_mut(user_id) {
            user.date_updated = now;
        }
    }

    pub fn mark_cycles_top_up(&mut self, user_id: &UserId, top_up: CyclesTopUp) -> bool {
        if let Some(user) = self.users.get_mut(user_id) {
            user.mark_cycles_top_up(top_up);
            true
        } else {
            false
        }
    }

    pub fn set_avatar_id(&mut self, user_id: &UserId, avatar_id: Option<u128>, now: TimestampMillis) -> bool {
        if let Some(user) = self.users.get_mut(user_id) {
            user.set_avatar_id(avatar_id, now);
            true
        } else {
            false
        }
    }

    pub fn set_chit(
        &mut self,
        user_id: &UserId,
        chit_event_timestamp: TimestampMillis,
        chit_balance: i32,
        streak: u16,
        streak_ends: TimestampMillis,
        now: TimestampMillis,
    ) -> bool {
        let Some(user) = self.users.get_mut(user_id) else {
            return false;
        };

        let chit_event_month = MonthKey::from_timestamp(chit_event_timestamp);

        if chit_event_timestamp >= user.latest_chit_event {
            if MonthKey::from_timestamp(user.latest_chit_event) == chit_event_month.previous() {
                user.latest_chit_event_previous_month = user.latest_chit_event;
            }
            user.latest_chit_event = chit_event_timestamp;
            user.streak = streak;
            user.streak_ends = streak_ends;
        } else {
            let previous_month = MonthKey::from_timestamp(now).previous();
            if chit_event_month == previous_month && chit_event_timestamp >= user.latest_chit_event_previous_month {
                user.latest_chit_event_previous_month = chit_event_timestamp;
            } else {
                return false;
            }
        }

        user.chit_updated = now;
        user.chit_per_month.insert(chit_event_month, chit_balance);
        true
    }

    pub fn suspend_user(
        &mut self,
        user_id: UserId,
        duration: Option<Milliseconds>,
        reason: String,
        suspended_by: UserId,
        now: TimestampMillis,
    ) -> bool {
        if let Some(user) = self.users.get_mut(&user_id) {
            user.suspension_details = Some(SuspensionDetails {
                timestamp: now,
                duration: duration.map_or(SuspensionDuration::Indefinitely, SuspensionDuration::Duration),
                reason,
                suspended_by,
            });
            self.suspended_or_unsuspended_users.insert((now, user_id));
            true
        } else {
            false
        }
    }

    pub fn unsuspend_user(&mut self, user_id: UserId, now: TimestampMillis) -> bool {
        if let Some(user) = self.users.get_mut(&user_id) {
            user.suspension_details = None;
            self.suspended_or_unsuspended_users.insert((now, user_id));
            true
        } else {
            false
        }
    }

    pub fn iter_suspended_or_unsuspended_users(&self, since: TimestampMillis) -> impl DoubleEndedIterator<Item = UserId> + '_ {
        self.suspended_or_unsuspended_users
            .range(RangeFrom {
                start: (since + 1, Principal::from_slice(&[0]).into()),
            })
            .map(|(_, u)| *u)
    }

    pub fn is_user_suspended(&self, user_id: &UserId) -> Option<bool> {
        self.users.get(user_id).map(|u| u.suspension_details.is_some())
    }

    pub fn search(&self, term: &str) -> impl Iterator<Item = (&User, bool)> {
        let term = term.to_uppercase();

        self.username_to_user_id.iter().filter_map(move |(username, user_id)| {
            if let Some(user) = self.users.get(user_id) {
                let username_match = username.find(&term).map(|s| s == 0);
                let display_name_match = user
                    .display_name_upper
                    .as_ref()
                    .and_then(|name| name.find(&term).map(|s| s == 0));

                if username_match == Some(true) || display_name_match == Some(true) {
                    Some((user, true))
                } else if username_match.is_some() || display_name_match.is_some() {
                    Some((user, false))
                } else {
                    None
                }
            } else {
                None
            }
        })
    }

    pub fn iter(&self) -> impl Iterator<Item = &User> {
        self.users.values()
    }

    pub fn iter_bots(&self) -> impl Iterator<Item = (&UserId, &Bot)> {
        self.bots.iter()
    }

    pub fn len(&self) -> usize {
        self.users.len()
    }

    pub fn referrals(&self, user_id: &UserId) -> Vec<UserId> {
        self.user_referrals.get(user_id).map_or(Vec::new(), |refs| refs.clone())
    }

    pub fn mark_suspected_bot(&mut self, principal: &Principal) {
        if let Some(user_id) = self.principal_to_user_id.get(principal) {
            self.suspected_bots.insert(*user_id);
        }
    }

    pub fn suspected_bots(&self, after: Option<UserId>, count: usize) -> Vec<UserId> {
        if let Some(after) = after {
            self.suspected_bots.range(&after..).skip(1).take(count).copied().collect()
        } else {
            self.suspected_bots.iter().take(count).copied().collect()
        }
    }

    pub fn is_suspected_bot(&self, user_id: &UserId) -> bool {
        self.suspected_bots.contains(user_id)
    }

    pub fn diamond_metrics(&self, now: TimestampMillis) -> DiamondMembershipUserMetrics {
        let mut metrics = DiamondMembershipUserMetrics::default();
        for user in self.users.values().filter(|u| u.diamond_membership_details.is_active(now)) {
            metrics.total += 1;
            if user.diamond_membership_details.is_lifetime_diamond_member() {
                metrics.lifetime += 1;
            }
            if user.diamond_membership_details.is_recurring() {
                metrics.recurring += 1;
            }
        }
        metrics
    }

    pub fn streak_badge_metrics(&self, now: TimestampMillis) -> BTreeMap<u16, u32> {
        let mut map = BTreeMap::new();
        let streak_badges = [365u16, 100, 30, 14, 7, 3];

        for streak in self.users.values().map(|u| u.streak(now)).filter(|s| *s >= 3) {
            let key = streak_badges.iter().find(|s| streak >= **s).copied().unwrap();
            *map.entry(key).or_default() += 1;
        }
        map
    }

    pub fn set_moderation_flags_enabled(&mut self, caller: &Principal, moderation_flags_enabled: u32) -> bool {
        if let Some(user) = self.principal_to_user_id.get(caller).and_then(|u| self.users.get_mut(u)) {
            user.moderation_flags_enabled = moderation_flags_enabled;
            true
        } else {
            false
        }
    }

    pub fn push_reported_message(&mut self, user_id: UserId, report_index: u64) -> bool {
        if let Some(user) = self.users.get_mut(&user_id) {
            user.reported_messages.push(report_index);
            true
        } else {
            false
        }
    }

    pub fn record_proof_of_unique_personhood(
        &mut self,
        user_id: UserId,
        proof: UniquePersonProof,
        now: TimestampMillis,
    ) -> bool {
        if let Some(user) = self.users.get_mut(&user_id) {
            if user.unique_person_proof.is_none() {
                self.unique_person_proofs_submitted += 1;
            }
            user.unique_person_proof = Some(proof);
            user.date_updated = now;
            true
        } else {
            false
        }
    }

    pub fn unique_person_proofs_submitted(&self) -> u32 {
        self.unique_person_proofs_submitted
    }

    // TODO - When a bot is added/removed to/from a community or group the user_index should be notified
    // so it can maintain a popularity score and use this for ordering results
    pub fn search_bots(&self, search_term: Option<String>, page_index: u32, page_size: u8) -> (Vec<BotMatch>, u32) {
        let query = search_term.map(Query::parse);

        let mut matches: Vec<_> = self
            .bots
            .iter()
            .map(|(user_id, bot)| {
                let score = if let Some(query) = &query {
                    SearchDocument::default()
                        .add_field(bot.name.clone(), 5.0, true)
                        .add_field(bot.description.clone(), 1.0, true)
                        .calculate_score(query)
                } else {
                    bot.commands.len() as u32
                };
                (score, user_id, bot)
            })
            .filter(|(score, _, _)| *score > 0)
            .collect();

        let total = matches.len() as u32;

        matches.sort_by_key(|(score, _, _)| *score);

        let matches = matches
            .into_iter()
            .rev()
            .map(|(s, id, b)| b.to_match(*id, s))
            .skip(page_index as usize * page_size as usize)
            .take(page_size as usize)
            .collect();

        (matches, total)
    }

    #[cfg(test)]
    pub fn add_test_user(&mut self, user: User) {
        let date_created = user.date_created;
        self.register(
            user.principal,
            user.user_id,
            user.username.clone(),
            None,
            user.date_created,
            None,
            UserType::User,
            None,
        );
        self.update(user, date_created, false, None);
    }
}

#[derive(Debug)]
pub enum UpdateUserResult {
    Success,
    PrincipalTaken,
    UsernameTaken,
    UserNotFound,
}

#[derive(Deserialize)]
struct UserMapTrimmed {
    users: HashMap<UserId, User>,
    #[serde(default)]
    bots: HashMap<UserId, Bot>,
    suspected_bots: BTreeSet<UserId>,
    deleted_users: HashMap<UserId, TimestampMillis>,
    #[serde(default)]
    suspended_or_unsuspended_users: BTreeSet<(TimestampMillis, UserId)>,
    #[serde(default)]
    unique_person_proofs_submitted: u32,
}

impl From<UserMapTrimmed> for UserMap {
    fn from(value: UserMapTrimmed) -> Self {
        let mut user_map = UserMap {
            users: value.users,
            suspected_bots: value.suspected_bots,
            deleted_users: value.deleted_users,
            suspended_or_unsuspended_users: value.suspended_or_unsuspended_users,
            unique_person_proofs_submitted: value.unique_person_proofs_submitted,
            bots: value.bots,
            username_to_user_id: CaseInsensitiveHashMap::default(),
            botname_to_user_id: CaseInsensitiveHashMap::default(),
            principal_to_user_id: HashMap::default(),
            user_referrals: HashMap::default(),
            users_with_duplicate_usernames: Vec::default(),
            users_with_duplicate_principals: Vec::default(),
        };

        for (user_id, user) in user_map.users.iter() {
            if let Some(referred_by) = user.referred_by {
                user_map.user_referrals.entry(referred_by).or_default().push(*user_id);
            }

            match user.user_type {
                UserType::BotV2 => {
                    user_map.botname_to_user_id.insert(&user.username, *user_id);
                }
                _ => {
                    if let Some(other_user_id) = user_map.username_to_user_id.insert(&user.username, *user_id) {
                        user_map.users_with_duplicate_usernames.push((*user_id, other_user_id));
                    }
                }
            }

            if let Some(other_user_id) = user_map.principal_to_user_id.insert(user.principal, *user_id) {
                user_map.users_with_duplicate_principals.push((*user_id, other_user_id));
            }

            if user.unique_person_proof.is_some() {
                user_map.unique_person_proofs_submitted += 1;
            }
        }

        user_map
            .suspended_or_unsuspended_users
            .retain(|(_, u)| !user_map.deleted_users.contains_key(u));

        user_map
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use itertools::Itertools;

    #[test]
    fn register_with_no_clashes() {
        let mut user_map = UserMap::default();
        let principal1 = Principal::from_slice(&[1]);
        let principal2 = Principal::from_slice(&[2]);
        let principal3 = Principal::from_slice(&[3]);

        let username1 = "1".to_string();
        let username2 = "2".to_string();
        let username3 = "3".to_string();

        let user_id1: UserId = Principal::from_slice(&[3, 1]).into();
        let user_id2: UserId = Principal::from_slice(&[3, 2]).into();
        let user_id3: UserId = Principal::from_slice(&[3, 3]).into();

        user_map.register(principal1, user_id1, username1.clone(), None, 1, None, UserType::User, None);
        user_map.register(principal2, user_id2, username2.clone(), None, 2, None, UserType::User, None);
        user_map.register(principal3, user_id3, username3.clone(), None, 3, None, UserType::User, None);

        let principal_to_user_id: Vec<_> = user_map
            .principal_to_user_id
            .iter()
            .map(|(p, u)| (*p, *u))
            .sorted_by_key(|(_, u)| *u)
            .collect();
        let username_to_user_id: Vec<_> = user_map
            .username_to_user_id
            .iter()
            .map(|(name, u)| (name.clone(), *u))
            .sorted_by_key(|(_, u)| *u)
            .collect();

        assert_eq!(user_map.users.len(), 3);

        assert_eq!(
            username_to_user_id,
            vec!((username1, user_id1), (username2, user_id2), (username3, user_id3))
        );
        assert_eq!(
            principal_to_user_id,
            vec!((principal1, user_id1), (principal2, user_id2), (principal3, user_id3))
        );
    }

    #[test]
    fn update_with_no_clashes() {
        let mut user_map = UserMap::default();
        let principal = Principal::from_slice(&[1]);

        let username1 = "1".to_string();
        let username2 = "2".to_string();

        let user_id = Principal::from_slice(&[1, 1]).into();

        user_map.register(principal, user_id, username1, None, 1, None, UserType::User, None);

        if let Some(original) = user_map.get_by_principal(&principal) {
            let mut updated = original.clone();
            updated.username.clone_from(&username2);

            assert!(matches!(user_map.update(updated, 3, false, None), UpdateUserResult::Success));

            assert_eq!(user_map.users.keys().collect_vec(), vec!(&user_id));
            assert_eq!(user_map.username_to_user_id.len(), 1);
            assert!(user_map.username_to_user_id.contains_key(&username2));
            assert_eq!(user_map.principal_to_user_id.keys().collect_vec(), vec!(&principal));
        }
    }

    #[test]
    fn update_with_clashing_username() {
        let mut user_map = UserMap::default();
        let principal1 = Principal::from_slice(&[1]);
        let principal2 = Principal::from_slice(&[2]);

        let username1 = "1".to_string();
        let username2 = "2".to_string();

        let user_id1 = Principal::from_slice(&[1, 1]).into();
        let user_id2 = Principal::from_slice(&[2, 2]).into();

        let original = User {
            principal: principal1,
            user_id: user_id1,
            username: username1,
            date_created: 1,
            date_updated: 1,
            ..Default::default()
        };

        let other = User {
            principal: principal2,
            user_id: user_id2,
            username: username2.clone(),
            date_created: 2,
            date_updated: 2,
            ..Default::default()
        };

        let mut updated = original.clone();
        updated.username = username2;

        user_map.add_test_user(original);
        user_map.add_test_user(other);
        assert!(matches!(
            user_map.update(updated, 3, false, None),
            UpdateUserResult::UsernameTaken
        ));
    }

    #[test]
    fn update_username_change_casing() {
        let mut user_map = UserMap::default();
        let principal = Principal::from_slice(&[1]);
        let username = "abc".to_string();
        let user_id = Principal::from_slice(&[1, 1]).into();

        let original = User {
            principal,
            user_id,
            username,
            date_created: 1,
            date_updated: 1,
            ..Default::default()
        };

        let mut updated = original.clone();

        user_map.add_test_user(original);
        updated.username = "ABC".to_string();

        assert!(matches!(user_map.update(updated, 2, false, None), UpdateUserResult::Success));
    }
}
