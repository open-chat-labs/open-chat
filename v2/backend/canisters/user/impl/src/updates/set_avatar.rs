use crate::updates::set_avatar::Response::*;
use crate::{RuntimeState, RUNTIME_STATE};
use cycles_utils::check_cycles_balance;
use ic_cdk_macros::update;
use log::error;
use types::{Avatar, CanisterId, FieldTooLongResult, MAX_AVATAR_SIZE};
use user_canister::set_avatar::*;
use user_index_canister::c2c_set_avatar;

#[update]
async fn set_avatar(args: Args) -> Response {
    check_cycles_balance();

    let id = args.id;

    let result = match RUNTIME_STATE.with(|state| prepare(&args, state.borrow().as_ref().unwrap())) {
        Err(response) => return response,
        Ok(r) => r,
    };

    match update_index_canister(result.user_index_canister_id, id).await {
        true => {
            RUNTIME_STATE.with(|state| commit(args, state.borrow_mut().as_mut().unwrap()));
            Success(id)
        }
        false => InternalError,
    }
}

struct PrepareResult {
    user_index_canister_id: CanisterId,
}

fn prepare(args: &Args, runtime_state: &RuntimeState) -> Result<PrepareResult, Response> {
    runtime_state.trap_if_caller_not_owner();

    if args.data.len() > MAX_AVATAR_SIZE as usize {
        Err(AvatarTooBig(FieldTooLongResult {
            length_provided: args.data.len() as u32,
            max_length: MAX_AVATAR_SIZE as u32,
        }))
    } else {
        Ok(PrepareResult {
            user_index_canister_id: runtime_state.data.user_index_canister_id,
        })
    }
}

fn commit(args: Args, runtime_state: &mut RuntimeState) {
    let avatar = Avatar {
        id: args.id,
        mime_type: args.mime_type,
        data: args.data,
    };

    runtime_state.data.avatar = Some(avatar);
}

async fn update_index_canister(user_index_canister_id: CanisterId, avatar_id: u128) -> bool {
    let args = c2c_set_avatar::Args { avatar_id };
    match user_index_canister_c2c_client::c2c_set_avatar(user_index_canister_id, &args).await {
        Ok(response) => match response {
            c2c_set_avatar::Response::Success => true,
            c2c_set_avatar::Response::UserNotFound => {
                error!("UserNotFound response calling c2c_set_avatar");
                false
            }
        },
        Err(error) => {
            error!("Error calling c2c_set_avatar: {:?}", error);
            false
        }
    }
}
