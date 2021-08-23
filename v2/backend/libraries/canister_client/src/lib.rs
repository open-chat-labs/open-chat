use candid::Principal;

pub mod canisters;
pub mod operations;
pub mod utils;

#[allow(dead_code)]
pub enum TestIdentity {
    Controller,
    User1,
    User2,
    User3,
}

pub struct CanisterIds {
    pub user_index: Principal,
    pub group_index: Principal,
    pub notifications: Principal,
}
