use core::cmp::Ordering;
use ic_cdk::export::candid::CandidType;
use multi_map::MultiMap;
use serde::Deserialize;
use shared::chat_id::ChatId;
use shared::storage::StableState;
use shared::timestamp::Timestamp;
use shared::user_id::UserId;

const MAX_USERS: u64 = 100_000;
const MAX_USERNAME_LENGTH: u16 = 25;
const MIN_USERNAME_LENGTH: u16 = 2;

#[derive(Default)]
pub struct UserStore {
    data: MultiMap<UserId, String, User>,
}

pub struct Stats {
    pub user_count: u64,
}

#[derive(CandidType, Deserialize, Debug)]
pub struct User {
    id: UserId,
    username: String,
    joined: Timestamp,
    last_online: Timestamp,
    last_updated: Timestamp,
    account_balance: u128,
    image_id: Option<String>,
    version: u32,
}

#[derive(CandidType)]
pub struct MyProfile {
    id: UserId,
    username: String,
    account_balance: u128,
    image_id: Option<String>,
    version: u32,
}

#[derive(CandidType)]
pub struct UserSummary {
    id: UserId,
    username: String,
    seconds_since_last_online: u32,
    image_id: Option<String>,
    chat_id: ChatId,
    version: u32,
}

#[derive(CandidType)]
pub enum RegisterUserResponse {
    Success(MyProfile),
    UserExists,
    UsernameTaken,
    UsernameTooShort(u16),
    UsernameTooLong(u16),
    UserLimitReached(u64),
}

#[derive(CandidType)]
pub enum UpdateUsernameResponse {
    Success,
    SuccessNoChange,
    UsernameTaken,
    UserNotFound,
    UsernameTooShort(u16),
    UsernameTooLong(u16),
}

#[derive(CandidType)]
pub enum TransferCyclesResponse {
    Success(TransferCyclesResult),
    UserNotFound,
    RecipientNotFound,
    BalanceExceeded,
}

#[derive(CandidType)]
pub struct TransferCyclesResult {
    new_balance: u128,
}

impl UserStore {
    pub fn register_user(
        &mut self,
        user_id: UserId,
        username: String,
        now: Timestamp,
    ) -> RegisterUserResponse {
        // Validation
        if username.len() > MAX_USERNAME_LENGTH as usize {
            return RegisterUserResponse::UsernameTooLong(MAX_USERNAME_LENGTH);
        }
        if username.len() < MIN_USERNAME_LENGTH as usize {
            return RegisterUserResponse::UsernameTooShort(MIN_USERNAME_LENGTH);
        }

        if self.data.iter().count() >= (MAX_USERS as usize) {
            return RegisterUserResponse::UserLimitReached(MAX_USERS);
        }

        if self.data.contains_key(&user_id) {
            return RegisterUserResponse::UserExists;
        }
        if self.data.contains_key_alt(&username) {
            return RegisterUserResponse::UsernameTaken;
        }

        let user = User {
            id: user_id,
            username: username.clone(),
            joined: now,
            last_online: now,
            last_updated: now,
            account_balance: 10_000_000_000_000,
            image_id: None,
            version: 1,
        };

        let my_profile = MyProfile::new(&user);

        self.data.insert(user_id, username, user);

        RegisterUserResponse::Success(my_profile)
    }

    pub fn update_username(
        &mut self,
        user_id: UserId,
        username: String,
        now: Timestamp,
    ) -> UpdateUsernameResponse {
        // Validation
        if username.len() > MAX_USERNAME_LENGTH as usize {
            return UpdateUsernameResponse::UsernameTooLong(MAX_USERNAME_LENGTH);
        }
        if username.len() < MIN_USERNAME_LENGTH as usize {
            return UpdateUsernameResponse::UsernameTooShort(MIN_USERNAME_LENGTH);
        }

        if let Some(match_by_username) = self.data.get_alt(&username) {
            return if match_by_username.id == user_id {
                UpdateUsernameResponse::SuccessNoChange
            } else {
                UpdateUsernameResponse::UsernameTaken
            };
        }

        if let Some(mut user) = self.data.remove(&user_id) {
            user.username = username.clone();
            user.last_online = now;
            user.last_updated = now;
            user.version += 1;

            self.data.insert(user_id, username, user);

            UpdateUsernameResponse::Success
        } else {
            UpdateUsernameResponse::UserNotFound
        }
    }

    pub fn set_profile_image(
        &mut self,
        user_id: &UserId,
        image_id: String,
        now: Timestamp,
    ) -> bool {
        match self.data.get_mut(user_id) {
            Some(user) => {
                user.image_id = Some(image_id);
                user.last_online = now;
                user.last_updated = now;
                user.version += 1;
                true
            }
            None => false,
        }
    }

    pub fn mark_as_online(&mut self, user_id: &UserId, now: Timestamp) {
        if let Some(user) = self.data.get_mut(user_id) {
            user.last_online = now;
        }
    }

    pub fn get_user_id(&self, username: &String) -> Option<UserId> {
        self.data.get_alt(username).map(|u| u.id)
    }

    pub fn get_my_profile(&self, user_id: &UserId) -> Option<MyProfile> {
        self.data.get(user_id).map(|u| MyProfile::new(u))
    }

    pub fn get_users(
        &self,
        users: Vec<UserId>,
        me: &UserId,
        updated_since: Option<Timestamp>,
        now: Timestamp,
    ) -> Vec<UserSummary> {
        fn filter(user: &User, updated_since: Timestamp) -> bool {
            user.last_online > updated_since || user.last_updated > updated_since
        }

        users
            .iter()
            .filter_map(|id| self.data.get(id))
            .filter(|u| {
                if let Some(updated_since) = updated_since {
                    filter(u, updated_since)
                } else {
                    true
                }
            })
            .map(|u| UserSummary::new(u, me, Some(now)))
            .collect()
    }

    pub fn search_users(
        &self,
        search_term: String,
        max_results: u8,
        me: &UserId,
        now: Timestamp,
    ) -> Vec<UserSummary> {
        // Filter
        let search_term_lower = search_term.to_lowercase();
        let mut matches: Vec<&String> = self
            .data
            .iter()
            .filter(|(user_id, (username, _))| {
                UserStore::username_matches(&search_term_lower, username) && *user_id != me
            })
            .map(|(_, (username, _))| username)
            .collect();

        // Sort
        matches.sort_unstable_by(|u1, u2| UserStore::order_usernames(&search_term, *u1, *u2));

        // Page
        matches
            .iter()
            .take(max_results as usize)
            .filter_map(|username| self.data.get_alt(username))
            .map(|u| UserSummary::new(u, me, Some(now)))
            .collect()
    }

    pub fn transfer_cycles(
        &mut self,
        my_id: &UserId,
        recipient_id: &UserId,
        amount: u128,
    ) -> TransferCyclesResponse {
        let new_balance: u128;
        {
            let me = self.data.get_mut(my_id);
            if me.is_none() {
                return TransferCyclesResponse::UserNotFound;
            }
            let me = me.unwrap();

            if me.account_balance < amount {
                return TransferCyclesResponse::BalanceExceeded;
            }

            me.account_balance -= amount;
            new_balance = me.account_balance;
        }

        {
            let recipient = self.data.get_mut(recipient_id);
            if recipient.is_none() {
                return TransferCyclesResponse::RecipientNotFound;
            }
            let recipient = recipient.unwrap();

            recipient.account_balance += amount;
        }

        TransferCyclesResponse::Success(TransferCyclesResult { new_balance })
    }

    pub fn get_stats(&self) -> Stats {
        Stats {
            user_count: self.data.iter().count() as u64,
        }
    }

    fn username_matches(search_term_lower: &str, username: &str) -> bool {
        username.to_lowercase().starts_with(search_term_lower)
    }

    fn order_usernames(search_term: &str, u1: &str, u2: &str) -> Ordering {
        let u1_starts = u1.starts_with(&search_term);
        let u2_starts = u2.starts_with(&search_term);

        if u1_starts != u2_starts {
            if u1_starts {
                Ordering::Less
            } else {
                Ordering::Greater
            }
        } else {
            match u1.len().cmp(&u2.len()) {
                Ordering::Less => Ordering::Less,
                Ordering::Equal => u1.cmp(u2),
                Ordering::Greater => Ordering::Greater,
            }
        }
    }
}

impl StableState for UserStore {
    type State = Vec<User>;

    fn drain(self) -> Vec<User> {
        self.data.into_iter().map(|(_, (_, u))| u).collect()
    }

    fn fill(users: Vec<User>) -> UserStore {
        let mut data = MultiMap::with_capacity(users.len());

        for user in users {
            data.insert(user.id, user.username.clone(), user);
        }

        UserStore { data }
    }
}

impl MyProfile {
    fn new(user: &User) -> MyProfile {
        MyProfile {
            id: user.id,
            username: user.username.clone(),
            account_balance: user.account_balance,
            image_id: user.image_id.clone(),
            version: user.version,
        }
    }
}

impl UserSummary {
    // You can pass in now = None if you know that the user is online now
    fn new(user: &User, me: &UserId, now: Option<Timestamp>) -> UserSummary {
        let mut seconds_since_last_online: u32 = 0;
        if let Some(t) = now {
            let millis_since_last_online = t - user.last_online;
            seconds_since_last_online = (millis_since_last_online / 1000) as u32;
        }

        UserSummary {
            id: user.id,
            username: user.username.clone(),
            seconds_since_last_online,
            image_id: user.image_id.clone(),
            chat_id: ChatId::for_direct_chat(me, &user.id),
            version: user.version,
        }
    }
}
