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
    Group,
    GroupIndex,
    Notifications,
    OnlineUsersAggregator,
    User,
    UserIndex,
}

impl FromStr for CanisterName {
    type Err = String;

    fn from_str(s: &str) -> Result<Self, Self::Err> {
        match s {
            "group" => Ok(CanisterName::Group),
            "group_index" => Ok(CanisterName::GroupIndex),
            "notifications" => Ok(CanisterName::Notifications),
            "online_users_aggregator" => Ok(CanisterName::OnlineUsersAggregator),
            "user" => Ok(CanisterName::User),
            "user_index" => Ok(CanisterName::UserIndex),
            _ => Err(format!("Unrecognised canister name: {s}")),
        }
    }
}

impl Display for CanisterName {
    fn fmt(&self, f: &mut Formatter<'_>) -> std::fmt::Result {
        let name = match self {
            CanisterName::Group => "group",
            CanisterName::GroupIndex => "group_index",
            CanisterName::Notifications => "notifications",
            CanisterName::OnlineUsersAggregator => "online_users_aggregator",
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
    pub open_storage_index: CanisterId,
}
