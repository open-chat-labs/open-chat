use ic_cdk::export::candid::CandidType;
use multi_map::MultiMap;
use serde::Deserialize;
use shared::storage::StableState;
use shared::timestamp::Timestamp;
use shared::user_id::UserId;

#[derive(Default)]
pub struct UserStore {
    data: MultiMap<UserId, String, User>
}

#[derive(CandidType, Deserialize, Debug)]
pub struct User {
    id: UserId,
    username: String,
    joined: Timestamp,
    last_online: Timestamp,
    last_updated: Timestamp,
    version: u32
}

#[derive(CandidType)]
pub struct UserSummary {
    id: UserId,
    username: String,
    minutes_since_last_online: u32,
    version: u32
}

#[derive(CandidType)]
pub enum RegisterUserResponse {
    Success(UserSummary),
    UserExists,
    UsernameTaken
}

#[derive(CandidType)]
pub enum UpdateUsernameResponse {
    Success,
    SuccessNoChange,
    UsernameTaken,
    UserNotFound
}

impl UserStore {
    pub fn register_user(&mut self, user_id: UserId, username: String, now: Timestamp) -> RegisterUserResponse {
        if self.data.contains_key(&user_id) { return RegisterUserResponse::UserExists; }
        if self.data.contains_key_alt(&username) { return RegisterUserResponse::UsernameTaken; }

        let user = User {
            id: user_id.clone(),
            username: username.clone(),
            joined: now,
            last_online: now,
            last_updated: now,
            version: 1
        };

        let user_summary = UserSummary::new(&user, None);

        self.data.insert(user_id, username, user);

        RegisterUserResponse::Success(user_summary)
    }

    pub fn update_username(&mut self, user_id: UserId, username: String, now: Timestamp) -> UpdateUsernameResponse {
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

    pub fn mark_as_online(&mut self, user_id: &UserId, now: Timestamp) {
        if let Some(user) = self.data.get_mut(user_id) {
            user.last_online = now;
        }
    }

    pub fn get_user_id(&self, username: &String) -> Option<UserId> {
        self.data.get_alt(username).map(|u| u.id.clone())
    }

    // You can pass in now = None if you know that the user is online now
    pub fn get_user(&self, user_id: &UserId, now: Option<Timestamp>) -> Option<UserSummary> {
        self.data.get(user_id).map(|u| UserSummary::new(u, now))
    }

    pub fn get_users(&self, users: Vec<UserId>, updated_since: Option<Timestamp>, now: Timestamp) -> Vec<UserSummary> {
        fn filter(user: &User, updated_since: Timestamp) -> bool {
            user.last_online > updated_since || user.last_updated > updated_since
        }

        users
            .iter()
            .filter_map(|id| self.data.get(&id))
            .filter(|u| if updated_since.is_some() { filter(u, updated_since.unwrap()) } else { true })
            .map(|u| UserSummary::new(u, Some(now)))
            .collect()
    }
}

impl StableState for UserStore {
    type State = Vec<User>;

    fn drain(self) -> Vec<User> {
        self.data
            .into_iter()
            .map(|(_, (_, u))| u)
            .collect()
    }
    
    fn fill(users: Vec<User>) -> UserStore {
        let mut data = MultiMap::with_capacity(users.len());

        for user in users {
            data.insert(user.id.clone(), user.username.clone(), user);
        }

        UserStore {
            data
        }
    }
}

impl UserSummary {
    // You can pass in now = None if you know that the user is online now
    fn new(user: &User, now: Option<Timestamp>) -> UserSummary {
        let mut minutes_since_last_online: u32 = 0;
        if let Some(t) = now {
            let millis_since_last_online = t - user.last_online;
            minutes_since_last_online = ((millis_since_last_online / 1000) / 60) as u32;
        }

        UserSummary {
            id: user.id.clone(),
            username: user.username.clone(),
            minutes_since_last_online,
            version: user.version
        }
    }
}
