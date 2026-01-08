use crate::guards::caller_is_local_user_index;
use crate::{RuntimeState, execute_update};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use oc_error_codes::OCErrorCode;
use types::OCResult;
use types::{c2c_uninstall_bot, uninstall_bot::*};

#[update(msgpack = true)]
#[trace]
fn uninstall_bot(args: Args) -> Response {
    execute_update(|state| {
        uninstall_bot_impl(
            c2c_uninstall_bot::Args {
                bot_id: args.bot_id,
                caller: state.env.caller().into(),
            },
            state,
        )
    })
    .into()
}

// TODO: remove this once user canisters have been upgraded
#[update(guard = "caller_is_local_user_index", msgpack = true)]
#[trace]
fn c2c_uninstall_bot(args: c2c_uninstall_bot::Args) -> Response {
    execute_update(|state| uninstall_bot_impl(args, state)).into()
}

fn uninstall_bot_impl(args: c2c_uninstall_bot::Args, state: &mut RuntimeState) -> OCResult {
    if args.caller != state.env.canister_id().into() && args.caller != state.data.owner.into() {
        return Err(OCErrorCode::InitiatorNotAuthorized.into());
    };

    if state.data.suspended.value {
        return Err(OCErrorCode::InitiatorSuspended.into());
    }

    state.uninstall_bot(args.bot_id, true);

    Ok(())
}
