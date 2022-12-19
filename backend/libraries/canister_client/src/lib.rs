use candid::{CandidType, Principal};
use std::fmt::{Display, Formatter};
use std::str::FromStr;
use types::{CanisterId, CanisterWasm, Cycles, Milliseconds, Version};

pub mod operations;
pub mod utils;

#[allow(dead_code)]
pub enum TestIdentity {
    Controller,
    User1,
    User2,
    User3,
}

pub const USER1_DEFAULT_NAME: &str = "Andy";
pub const USER2_DEFAULT_NAME: &str = "Bob";
pub const USER3_DEFAULT_NAME: &str = "Charlie";

#[derive(Debug)]
pub enum CanisterName {
    Group,
    LocalGroupIndex,
    GroupIndex,
    Notifications,
    OnlineUsersAggregator,
    ProposalsBot,
    User,
    LocalUserIndex,
    UserIndex,
}

impl FromStr for CanisterName {
    type Err = String;

    fn from_str(s: &str) -> Result<Self, Self::Err> {
        match s {
            "group" => Ok(CanisterName::Group),
            "local_group_index" => Ok(CanisterName::LocalGroupIndex),
            "group_index" => Ok(CanisterName::GroupIndex),
            "notifications" => Ok(CanisterName::Notifications),
            "online_users_aggregator" => Ok(CanisterName::OnlineUsersAggregator),
            "proposals_bot" => Ok(CanisterName::ProposalsBot),
            "user" => Ok(CanisterName::User),
            "user_index" => Ok(CanisterName::UserIndex),
            "local_user_index" => Ok(CanisterName::LocalUserIndex),
            _ => Err(format!("Unrecognised canister name: {s}")),
        }
    }
}

impl Display for CanisterName {
    fn fmt(&self, f: &mut Formatter<'_>) -> std::fmt::Result {
        let name = match self {
            CanisterName::Group => "group",
            CanisterName::LocalGroupIndex => "local_group_index",
            CanisterName::GroupIndex => "group_index",
            CanisterName::Notifications => "notifications",
            CanisterName::OnlineUsersAggregator => "online_users_aggregator",
            CanisterName::ProposalsBot => "proposals_bot",
            CanisterName::User => "user",
            CanisterName::LocalUserIndex => "local_user_index",
            CanisterName::UserIndex => "user_index",
        };

        f.write_str(name)
    }
}

#[derive(Debug)]
pub struct CanisterIds {
    pub user_index: CanisterId,
    pub group_index: CanisterId,
    pub notifications: CanisterId,
    pub online_users_aggregator: CanisterId,
    pub proposals_bot: CanisterId,
    pub cycles_dispenser: CanisterId,
    pub open_storage_index: CanisterId,
    pub ledger: CanisterId,
}

#[derive(Debug)]
pub enum OpenStorageCanisterName {
    Index,
    Bucket,
}

impl Display for OpenStorageCanisterName {
    fn fmt(&self, f: &mut Formatter<'_>) -> std::fmt::Result {
        let name = match self {
            OpenStorageCanisterName::Index => "index",
            OpenStorageCanisterName::Bucket => "bucket",
        };

        f.write_str(name)
    }
}

#[derive(CandidType, Debug)]
pub struct CyclesDispenserInitArgs {
    pub admins: Vec<Principal>,
    pub canisters: Vec<CanisterId>,
    pub max_top_up_amount: Cycles,
    pub min_interval: Milliseconds,
    pub min_cycles_balance: Cycles,
}

#[derive(CandidType, Debug)]
pub struct OpenStorageInitArgs {
    pub service_principals: Vec<Principal>,
    pub bucket_canister_wasm: CanisterWasm,
    pub wasm_version: Version,
    pub test_mode: bool,
}
