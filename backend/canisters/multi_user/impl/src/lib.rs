use crate::model::direct_chat_cores::DirectChatCores;
use crate::model::user::User;
use crate::model::users::Users;
use candid::Principal;
use canister_state_macros::canister_state;
use direct_chat_core::{DirectChatMut, DirectChatRef};
use oc_error_codes::OCErrorCode;
use serde::{Deserialize, Serialize};
use stable_memory_map::BaseKeyPrefix;
use std::cell::RefCell;
use std::collections::BTreeMap;
use types::{BuildVersion, CanisterId, ChatId, Cycles, OCResult, TimestampMillis, Timestamped, UserId};
use utils::env::Environment;

mod guards;
mod jobs;
mod lifecycle;
mod memory;
mod model;
mod queries;
mod updates;

thread_local! {
    static WASM_VERSION: RefCell<Timestamped<BuildVersion>> = RefCell::default();
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

    pub fn is_caller_local_user_index(&self) -> bool {
        self.env.caller() == self.data.local_user_index_canister_id
    }

    // The index of the user the caller owns, if the caller is one of this canister's users
    pub fn caller_user_index(&self) -> Option<u16> {
        self.data.users.index_by_principal(&self.env.caller())
    }

    // The index within this canister of the user with the given id, provided the caller may act as
    // that user: either the caller owns the user, or the caller is the LocalUserIndex, which acts
    // for any user. The user is not looked up here, so acting on the index can still find no user.
    pub fn authorized_user_index(&self, user_id: UserId) -> OCResult<u16> {
        let index = self.user_index(user_id).ok_or(OCErrorCode::TargetUserNotFound)?;
        if self.is_caller_local_user_index() || self.caller_user_index() == Some(index) {
            Ok(index)
        } else {
            Err(OCErrorCode::InitiatorNotAuthorized.into())
        }
    }

    // The id of the user at the given index within this canister
    pub fn user_id(&self, index: u16) -> UserId {
        UserId::new_indexed(self.env.canister_id(), index)
    }

    // Runs `f` against the user with the given id, within that user's key scope. Fails if the id
    // does not belong to a user in this canister.
    pub fn with_user<R>(&self, user_id: UserId, f: impl FnOnce(&User) -> R) -> OCResult<R> {
        self.user_index(user_id)
            .and_then(|index| self.data.users.with_user(index, f))
            .ok_or_else(|| OCErrorCode::TargetUserNotFound.into())
    }

    // Runs `f` against the direct chat of the user at `user_index` with the user `chat_id` is the
    // id of, as seen from that user's side. Fails if there is no such user or chat.
    pub fn with_direct_chat<R>(&self, user_index: u16, chat_id: ChatId, f: impl FnOnce(DirectChatRef) -> R) -> OCResult<R> {
        let cores = &self.data.direct_chat_cores;
        self.data
            .users
            .with_user(user_index, |user| {
                user.direct_chats.get(&chat_id).map(|chat| cores.with_chat(chat, f))
            })
            .ok_or(OCErrorCode::TargetUserNotFound)?
            .ok_or_else(|| OCErrorCode::ChatNotFound.into())
    }

    pub fn with_direct_chat_mut<R>(
        &mut self,
        user_index: u16,
        chat_id: ChatId,
        f: impl FnOnce(DirectChatMut) -> R,
    ) -> OCResult<R> {
        let cores = &mut self.data.direct_chat_cores;
        self.data
            .users
            .with_user_mut(user_index, |user| {
                user.direct_chats.get_mut(&chat_id).map(|chat| cores.with_chat_mut(chat, f))
            })
            .ok_or(OCErrorCode::TargetUserNotFound)?
            .ok_or_else(|| OCErrorCode::ChatNotFound.into())
    }

    // The index within this canister carried by the user id, or None if the id is for a user in a
    // different canister. An id which carries no index maps to index 0, which is never assigned.
    fn user_index(&self, user_id: UserId) -> Option<u16> {
        (user_id.canister_id() == self.env.canister_id()).then(|| user_id.index())
    }

    pub fn metrics(&self) -> Metrics {
        Metrics {
            heap_memory_used: utils::memory::heap(),
            stable_memory_used: utils::memory::stable(),
            now: self.env.now(),
            cycles_balance: self.env.cycles_balance(),
            liquid_cycles_balance: self.env.liquid_cycles_balance(),
            wasm_version: WASM_VERSION.with_borrow(|v| **v),
            git_commit_id: git_commit_id::git_commit_id().to_string(),
            stable_memory_sizes: memory::memory_sizes(),
            user_count: self.data.users.len() as u32,
            direct_chat_cores: self.data.direct_chat_cores.len() as u32,
            stable_memory_keys_to_garbage_collect: self.data.stable_memory_keys_to_garbage_collect.len() as u32,
            canister_ids: CanisterIds {
                user_index: self.data.user_index_canister_id,
                local_user_index: self.data.local_user_index_canister_id,
                group_index: self.data.group_index_canister_id,
                identity: self.data.identity_canister_id,
                escrow: self.data.escrow_canister_id,
            },
        }
    }
}

#[derive(Serialize, Deserialize)]
struct Data {
    // The defaults below cover MultiUser canisters created before these fields existed. None of
    // those hold any users.
    #[serde(default)]
    pub users: Users,
    #[serde(default)]
    pub direct_chat_cores: DirectChatCores,
    pub user_index_canister_id: CanisterId,
    pub local_user_index_canister_id: CanisterId,
    #[serde(default = "CanisterId::anonymous")]
    pub group_index_canister_id: CanisterId,
    #[serde(default = "CanisterId::anonymous")]
    pub identity_canister_id: CanisterId,
    #[serde(default = "CanisterId::anonymous")]
    pub escrow_canister_id: CanisterId,
    #[serde(default)]
    pub video_call_operators: Vec<Principal>,
    // The prefixes of deleted direct chat cores, whose entries are removed by a background job
    #[serde(default)]
    pub stable_memory_keys_to_garbage_collect: Vec<BaseKeyPrefix>,
    pub rng_seed: [u8; 32],
    pub test_mode: bool,
}

impl Data {
    #[expect(clippy::too_many_arguments)]
    pub fn new(
        user_index_canister_id: CanisterId,
        local_user_index_canister_id: CanisterId,
        group_index_canister_id: CanisterId,
        identity_canister_id: CanisterId,
        escrow_canister_id: CanisterId,
        video_call_operators: Vec<Principal>,
        rng_seed: [u8; 32],
        test_mode: bool,
    ) -> Data {
        Data {
            users: Users::default(),
            direct_chat_cores: DirectChatCores::default(),
            user_index_canister_id,
            local_user_index_canister_id,
            group_index_canister_id,
            identity_canister_id,
            escrow_canister_id,
            video_call_operators,
            stable_memory_keys_to_garbage_collect: Vec::new(),
            rng_seed,
            test_mode,
        }
    }
}

#[derive(Serialize, Debug)]
pub struct Metrics {
    pub now: TimestampMillis,
    pub heap_memory_used: u64,
    pub stable_memory_used: u64,
    pub cycles_balance: Cycles,
    pub liquid_cycles_balance: Cycles,
    pub wasm_version: BuildVersion,
    pub git_commit_id: String,
    pub stable_memory_sizes: BTreeMap<u8, u64>,
    pub user_count: u32,
    pub direct_chat_cores: u32,
    pub stable_memory_keys_to_garbage_collect: u32,
    pub canister_ids: CanisterIds,
}

#[derive(Serialize, Debug)]
pub struct CanisterIds {
    pub user_index: CanisterId,
    pub local_user_index: CanisterId,
    pub group_index: CanisterId,
    pub identity: CanisterId,
    pub escrow: CanisterId,
}
