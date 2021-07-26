use super::create_group::Response::*;
use crate::canister::RUNTIME_STATE;
use crate::model::group_chat::GroupChat;
use crate::model::runtime_state::RuntimeState;
use candid::{CandidType, Principal};
use ic_cdk::api::call::CallResult;
use ic_cdk_macros::update;
use log::error;
use serde::Deserialize;
use shared::c2c::call_with_logging;
use shared::types::chat_id::GroupChatId;
use shared::types::CanisterId;

#[derive(Deserialize)]
struct Args {
    is_public: bool,
    name: String,
}

#[derive(CandidType)]
enum Response {
    Success(SuccessResult),
    NameTaken,
    Throttled,
    InternalError,
    NotAuthorised,
}

#[derive(CandidType)]
struct SuccessResult {
    pub group_chat_id: GroupChatId,
}

#[update]
async fn create_group(args: Args) -> Response {
    let prepare_result = match RUNTIME_STATE.with(|state| prepare(args, state.borrow().as_ref().unwrap())) {
        Ok(ok) => ok,
        Err(response) => return response,
    };

    match group_index_canister::call_create_group(prepare_result.group_index_canister_id, prepare_result.create_group_args)
        .await
    {
        Ok(response) => match response.0 {
            group_index_canister::CreateGroupResponse::Success(r) => {
                RUNTIME_STATE.with(|state| commit(r.group_id, state.borrow_mut().as_mut().unwrap()));
                Success(SuccessResult {
                    group_chat_id: r.group_id,
                })
            }
            group_index_canister::CreateGroupResponse::NameTaken => NameTaken,
            group_index_canister::CreateGroupResponse::CyclesBalanceTooLow => InternalError,
            group_index_canister::CreateGroupResponse::InternalError => InternalError,
        },
        Err(error) => {
            error!("Error calling create group: {:?}", error);
            InternalError
        }
    }
}

struct PrepareResult {
    group_index_canister_id: CanisterId,
    create_group_args: group_index_canister::CreateGroupArgs,
}

fn prepare(args: Args, runtime_state: &RuntimeState) -> Result<PrepareResult, Response> {
    fn is_throttled() -> bool {
        // TODO check here that the user hasn't created too many groups in succession
        false
    }

    if runtime_state.is_caller_owner() {
        if is_throttled() {
            Err(Throttled)
        } else {
            let create_group_args = group_index_canister::CreateGroupArgs {
                is_public: args.is_public,
                creator_principal: runtime_state.env.caller(),
                name: args.name,
            };
            Ok(PrepareResult {
                group_index_canister_id: runtime_state.data.group_index_canister_id,
                create_group_args,
            })
        }
    } else {
        Err(NotAuthorised)
    }
}

fn commit(group_chat_id: GroupChatId, runtime_state: &mut RuntimeState) {
    runtime_state
        .data
        .group_chats
        .insert(group_chat_id, GroupChat::new(group_chat_id));
}

mod group_index_canister {
    use super::*;

    pub async fn call_create_group(
        group_index_canister_id: CanisterId,
        args: CreateGroupArgs,
    ) -> CallResult<(CreateGroupResponse,)> {
        call_with_logging(group_index_canister_id, "create_group", (args,)).await
    }

    #[derive(CandidType)]
    pub struct CreateGroupArgs {
        pub is_public: bool,
        pub creator_principal: Principal,
        pub name: String,
    }

    #[derive(Deserialize)]
    pub enum CreateGroupResponse {
        Success(CreateGroupSuccessResult),
        NameTaken,
        CyclesBalanceTooLow,
        InternalError,
    }

    #[derive(Deserialize)]
    pub struct CreateGroupSuccessResult {
        pub group_id: GroupChatId,
    }
}
