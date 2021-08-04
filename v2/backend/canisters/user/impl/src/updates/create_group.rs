use crate::model::group_chat::GroupChat;
use crate::{RuntimeState, RUNTIME_STATE};
use group_index_canister::updates::create_group;
use ic_cdk_macros::update;
use log::error;
use shared::types::chat_id::GroupChatId;
use shared::types::CanisterId;
use user_canister::updates::create_group::{Response::*, *};

#[update]
async fn create_group(args: Args) -> Response {
    let prepare_result = match RUNTIME_STATE.with(|state| prepare(args, state.borrow().as_ref().unwrap())) {
        Ok(ok) => ok,
        Err(response) => return response,
    };

    match c2c::group_index::create_group(prepare_result.group_index_canister_id, &prepare_result.create_group_args).await {
        Ok(response) => match response.0 {
            create_group::Response::Success(r) => {
                RUNTIME_STATE.with(|state| commit(r.group_id, state.borrow_mut().as_mut().unwrap()));
                Success(SuccessResult {
                    group_chat_id: r.group_id,
                })
            }
            create_group::Response::NameTaken => NameTaken,
            create_group::Response::CyclesBalanceTooLow => InternalError,
            create_group::Response::InternalError => InternalError,
        },
        Err(error) => {
            error!("Error calling create group: {:?}", error);
            InternalError
        }
    }
}

struct PrepareResult {
    group_index_canister_id: CanisterId,
    create_group_args: create_group::Args,
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
            let create_group_args = create_group::Args {
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

mod c2c {
    use super::*;
    use ic_cdk::api::call::CallResult;
    use shared::generate_c2c_call;

    pub mod group_index {
        use super::*;

        generate_c2c_call!(create_group);
    }
}
