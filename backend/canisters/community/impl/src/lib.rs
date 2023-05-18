use crate::model::groups::Groups;
use crate::model::members::CommunityMembers;
use candid::Principal;
use canister_state_macros::canister_state;
use model::{events::CommunityEvents, invited_users::InvitedUsers, members::CommunityMemberInternal};
use serde::{Deserialize, Serialize};
use std::cell::RefCell;
use types::{
    Avatar, CanisterId, CommunityPermissions, CommunitySummary, Cycles, FrozenGroupInfo, GroupGate, GroupRules,
    TimestampMillis, Timestamped, UserId, Version,
};
use utils::env::Environment;

mod guards;
mod jobs;
mod lifecycle;
mod memory;
mod model;
mod queries;
mod updates;

thread_local! {
    static WASM_VERSION: RefCell<Timestamped<Version>> = RefCell::default();
}

canister_state!(RuntimeState);

struct RuntimeState {
    pub env: Box<dyn Environment>,
    pub data: Data,
}

impl RuntimeState {
    pub fn new(env: Box<dyn Environment>, data: Data) -> RuntimeState {
        RuntimeState { env, data }
    }

    pub fn is_caller_user_index(&self) -> bool {
        self.env.caller() == self.data.user_index_canister_id
    }

    pub fn is_caller_local_user_index(&self) -> bool {
        self.env.caller() == self.data.local_user_index_canister_id
    }

    pub fn is_caller_group_index(&self) -> bool {
        self.env.caller() == self.data.group_index_canister_id
    }

    pub fn is_caller_local_group_index(&self) -> bool {
        self.env.caller() == self.data.local_group_index_canister_id
    }

    pub fn summary(&self, member: &CommunityMemberInternal, now: TimestampMillis) -> CommunitySummary {
        let data = &self.data;

        CommunitySummary {
            community_id: self.env.canister_id().into(),
            last_updated: now,
            name: data.name.clone(),
            description: data.description.clone(),
            avatar_id: Avatar::id(&data.avatar),
            is_public: data.is_public,
            latest_event_index: data.events.latest_event_index(),
            joined: member.date_added,
            member_count: data.members.len(),
            role: member.role,
            permissions: data.permissions.clone(),
            frozen: data.frozen.value.clone(),
            gate: data.gate.value.clone(),
        }
    }

    pub fn metrics(&self) -> Metrics {
        Metrics {
            memory_used: utils::memory::used(),
            now: self.env.now(),
            cycles_balance: self.env.cycles_balance(),
            wasm_version: WASM_VERSION.with(|v| **v.borrow()),
            git_commit_id: utils::git::git_commit_id().to_string(),
            canister_ids: CanisterIds {
                user_index: self.data.user_index_canister_id,
                group_index: self.data.group_index_canister_id,
                local_user_index: self.data.local_user_index_canister_id,
                local_group_index: self.data.local_group_index_canister_id,
                notifications: self.data.notifications_canister_id,
            },
            public: self.data.is_public,
            date_created: self.data.date_created,
            members: self.data.members.len(),
            admins: self.data.members.admin_count(),
            owners: self.data.members.owner_count(),
            blocked: self.data.members.blocked().len() as u32,
            invited: self.data.invited_users.len() as u32,
            frozen: self.data.is_frozen(),
        }
    }
}

#[derive(Serialize, Deserialize)]
struct Data {
    is_public: bool,
    name: String,
    description: String,
    rules: GroupRules,
    avatar: Option<Avatar>,
    permissions: CommunityPermissions,
    gate: Timestamped<Option<GroupGate>>,
    user_index_canister_id: CanisterId,
    local_user_index_canister_id: CanisterId,
    group_index_canister_id: CanisterId,
    local_group_index_canister_id: CanisterId,
    notifications_canister_id: CanisterId,
    proposals_bot_user_id: UserId,
    date_created: TimestampMillis,
    members: CommunityMembers,
    groups: Groups,
    events: CommunityEvents,
    invited_users: InvitedUsers,
    invite_code: Option<u64>,
    invite_code_enabled: bool,
    frozen: Timestamped<Option<FrozenGroupInfo>>,
    test_mode: bool,
}

impl Data {
    fn new(
        created_by_principal: Principal,
        created_by_user_id: UserId,
        is_public: bool,
        name: String,
        description: String,
        rules: GroupRules,
        avatar: Option<Avatar>,
        permissions: CommunityPermissions,
        user_index_canister_id: CanisterId,
        local_user_index_canister_id: CanisterId,
        group_index_canister_id: CanisterId,
        local_group_index_canister_id: CanisterId,
        notifications_canister_id: CanisterId,
        proposals_bot_user_id: UserId,
        gate: Option<GroupGate>,
        test_mode: bool,
        now: TimestampMillis,
    ) -> Data {
        let members = CommunityMembers::new(created_by_principal, created_by_user_id, now);
        let events = CommunityEvents::new(name.clone(), description.clone(), created_by_user_id, now);

        Data {
            is_public,
            name,
            description,
            rules,
            avatar,
            permissions,
            gate: Timestamped::new(gate, now),
            user_index_canister_id,
            local_user_index_canister_id,
            group_index_canister_id,
            local_group_index_canister_id,
            notifications_canister_id,
            proposals_bot_user_id,
            date_created: now,
            members,
            groups: Groups::default(),
            events,
            invited_users: InvitedUsers::default(),
            invite_code: None,
            invite_code_enabled: false,
            frozen: Timestamped::default(),
            test_mode,
        }
    }

    pub fn is_frozen(&self) -> bool {
        self.frozen.is_some()
    }

    pub fn is_accessible(&self, caller: Principal, invite_code: Option<u64>) -> bool {
        self.is_public
            || self.members.get(caller).is_some()
            || self.invited_users.get(&caller).is_some()
            || self.is_invite_code_valid(invite_code)
    }

    fn is_invite_code_valid(&self, invite_code: Option<u64>) -> bool {
        if self.invite_code_enabled {
            if let Some(provided_code) = invite_code {
                if let Some(stored_code) = self.invite_code {
                    return provided_code == stored_code;
                }
            }
        }

        false
    }
}

#[derive(Serialize, Debug)]
pub struct Metrics {
    pub memory_used: u64,
    pub now: TimestampMillis,
    pub cycles_balance: Cycles,
    pub wasm_version: Version,
    pub git_commit_id: String,
    pub canister_ids: CanisterIds,
    pub public: bool,
    pub date_created: TimestampMillis,
    pub members: u32,
    pub admins: u32,
    pub owners: u32,
    pub blocked: u32,
    pub invited: u32,
    pub frozen: bool,
}

#[derive(Serialize, Debug)]
pub struct CanisterIds {
    pub user_index: CanisterId,
    pub group_index: CanisterId,
    pub local_user_index: CanisterId,
    pub local_group_index: CanisterId,
    pub notifications: CanisterId,
}
