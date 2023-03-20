use std::fmt::{Display, Formatter};
use std::str::FromStr;
use types::CanisterId;

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
    CyclesDispenser,
    Group,
    GroupIndex,
    LocalGroupIndex,
    LocalUserIndex,
    Notifications,
    NotificationsIndex,
    OnlineUsers,
    ProposalsBot,
    StorageBucket,
    StorageIndex,
    User,
    UserIndex,
}

impl FromStr for CanisterName {
    type Err = String;

    fn from_str(s: &str) -> Result<Self, Self::Err> {
        match s {
            "cycles_dispenser" => Ok(CanisterName::CyclesDispenser),
            "group" => Ok(CanisterName::Group),
            "group_index" => Ok(CanisterName::GroupIndex),
            "local_group_index" => Ok(CanisterName::LocalGroupIndex),
            "local_user_index" => Ok(CanisterName::LocalUserIndex),
            "notifications" => Ok(CanisterName::Notifications),
            "notifications_index" => Ok(CanisterName::NotificationsIndex),
            "online_users" => Ok(CanisterName::OnlineUsers),
            "proposals_bot" => Ok(CanisterName::ProposalsBot),
            "storage_bucket" => Ok(CanisterName::StorageBucket),
            "storage_index" => Ok(CanisterName::StorageIndex),
            "user" => Ok(CanisterName::User),
            "user_index" => Ok(CanisterName::UserIndex),
            _ => Err(format!("Unrecognised canister name: {s}")),
        }
    }
}

impl Display for CanisterName {
    fn fmt(&self, f: &mut Formatter<'_>) -> std::fmt::Result {
        let name = match self {
            CanisterName::CyclesDispenser => "cycles_dispenser",
            CanisterName::Group => "group",
            CanisterName::GroupIndex => "group_index",
            CanisterName::LocalGroupIndex => "local_group_index",
            CanisterName::LocalUserIndex => "local_user_index",
            CanisterName::Notifications => "notifications",
            CanisterName::NotificationsIndex => "notifications_index",
            CanisterName::OnlineUsers => "online_users",
            CanisterName::ProposalsBot => "proposals_bot",
            CanisterName::StorageBucket => "storage_bucket",
            CanisterName::StorageIndex => "storage_index",
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
    pub notifications_index: CanisterId,
    pub local_user_index: CanisterId,
    pub local_group_index: CanisterId,
    pub notifications: CanisterId,
    pub online_users: CanisterId,
    pub proposals_bot: CanisterId,
    pub storage_index: CanisterId,
    pub cycles_dispenser: CanisterId,
    pub nns_governance: CanisterId,
    pub nns_ledger: CanisterId,
    pub nns_cmc: CanisterId,
}
