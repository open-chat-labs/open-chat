use ic_cdk::export::candid::CandidType;
use multi_map::MultiMap;
use serde::Deserialize;
use shared::storage::StableState;
use shared::timestamp::Timestamp;
use shared::user_id::UserId;
use crate::queries::get_users::Request;

#[derive(Default)]
pub struct UserStore {
    data: MultiMap<UserId, String, User>
}

#[derive(CandidType, Deserialize, Debug)]
pub struct User {
    id: UserId,
    username: String,
    joined: Timestamp,
    last_updated: Timestamp,
    version: u32
}

#[derive(CandidType)]
pub struct UserSummary {
    id: UserId,
    username: String,
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
            last_updated: now,
            version: 1
        };

        let user_summary = UserSummary::new(&user);

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
            user.last_updated = now;
            user.version += 1;

            self.data.insert(user_id, username, user);

            UpdateUsernameResponse::Success
        } else {
            UpdateUsernameResponse::UserNotFound
        }
    }

    pub fn get_user_id(&self, username: &String) -> Option<UserId> {
        self.data.get_alt(username).map(|u| u.id.clone())
    }

    pub fn get_user(&self, user_id: &UserId) -> Option<UserSummary> {
        self.data.get(user_id).map(UserSummary::new)
    }

    pub fn get_users(&self, users: Vec<Request>) -> Vec<UserSummary> {
        users
            .iter()
            .filter_map(|r| self.data.get(&r.id).map(|u| (u, r.cached_version)))
            .filter(|(u, v)| v.is_none() || v.unwrap() < u.version)
            .map(|(u, _)| UserSummary::new(u))
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
    fn new(user: &User) -> UserSummary {
        UserSummary {
            id: user.id.clone(),
            username: user.username.clone(),
            version: user.version
        }
    }
}
