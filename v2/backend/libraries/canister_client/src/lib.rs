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

#[derive(Debug)]
pub enum CanisterName {
    Group,
    GroupIndex,
    Notifications,
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
            "user" => Ok(CanisterName::User),
            "user_index" => Ok(CanisterName::UserIndex),
            _ => Err(format!("Unrecognised canister name: {}", s)),
        }
    }
}

impl Display for CanisterName {
    fn fmt(&self, f: &mut Formatter<'_>) -> std::fmt::Result {
        let name = match self {
            CanisterName::Group => "group",
            CanisterName::GroupIndex => "group_index",
            CanisterName::Notifications => "notifications",
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
}
