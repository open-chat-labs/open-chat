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
    Callback,
    Group,
    GroupIndex,
    Notifications,
    OnlineUsersAggregator,
    ProposalsBot,
    User,
    UserIndex,
}

impl FromStr for CanisterName {
    type Err = String;

    fn from_str(s: &str) -> Result<Self, Self::Err> {
        match s {
            "callback" => Ok(CanisterName::Callback),
            "group" => Ok(CanisterName::Group),
            "group_index" => Ok(CanisterName::GroupIndex),
            "notifications" => Ok(CanisterName::Notifications),
            "online_users_aggregator" => Ok(CanisterName::OnlineUsersAggregator),
            "proposals_bot" => Ok(CanisterName::ProposalsBot),
            "user" => Ok(CanisterName::User),
            "user_index" => Ok(CanisterName::UserIndex),
            _ => Err(format!("Unrecognised canister name: {s}")),
        }
    }
}

impl Display for CanisterName {
    fn fmt(&self, f: &mut Formatter<'_>) -> std::fmt::Result {
        let name = match self {
            CanisterName::Callback => "callback",
            CanisterName::Group => "group",
            CanisterName::GroupIndex => "group_index",
            CanisterName::Notifications => "notifications",
            CanisterName::OnlineUsersAggregator => "online_users_aggregator",
            CanisterName::ProposalsBot => "proposals_bot",
            CanisterName::User => "user",
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
    pub callback: CanisterId,
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
