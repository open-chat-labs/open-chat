use crate::guards::caller_is_local_user_index;
use crate::{RuntimeState, execute_update};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use constants::OPENCHAT_BOT_USER_ID;
use oc_error_codes::OCErrorCode;
use types::c2c_uninstall_bot::*;
use types::{BotEvent, BotInstallationLocation, BotLifecycleEvent, BotNotification, BotUninstalledEvent, OCResult};

#[update(guard = "caller_is_local_user_index", msgpack = true)]
#[trace]
fn c2c_uninstall_bot(args: Args) -> Response {
    execute_update(|state| c2c_uninstall_bot_impl(args, state)).into()
}

fn c2c_uninstall_bot_impl(args: Args, state: &mut RuntimeState) -> OCResult {
    if args.caller != OPENCHAT_BOT_USER_ID {
        if args.caller != state.env.canister_id().into() {
            return Err(OCErrorCode::InitiatorNotAuthorized.into());
        };

        if state.data.suspended.value {
            return Err(OCErrorCode::InitiatorSuspended.into());
        }
    }

    let now = state.env.now();

    state.data.bots.remove(args.bot_id, now);
    state.delete_direct_chat(args.bot_id, false, now);

    state.push_bot_notification(Some(BotNotification {
        event: BotEvent::Lifecycle(BotLifecycleEvent::Uninstalled(BotUninstalledEvent {
            uninstalled_by: args.caller,
            location: BotInstallationLocation::Group(args.caller.into()),
        })),
        recipients: vec![args.bot_id],
    }));

    Ok(())
}
