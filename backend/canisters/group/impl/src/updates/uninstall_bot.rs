use crate::guards::caller_is_local_user_index;
use crate::{RuntimeState, activity_notifications::handle_activity_notification, execute_update};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use oc_error_codes::OCErrorCode;
use types::{BotEvent, BotInstallationLocation, BotLifecycleEvent, BotNotification, BotUninstalledEvent, OCResult};
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

// TODO: remove this once group canisters have been upgraded
#[update(guard = "caller_is_local_user_index", msgpack = true)]
#[trace]
fn c2c_uninstall_bot(args: c2c_uninstall_bot::Args) -> c2c_uninstall_bot::Response {
    execute_update(|state| uninstall_bot_impl(args, state)).into()
}

fn uninstall_bot_impl(args: c2c_uninstall_bot::Args, state: &mut RuntimeState) -> OCResult {
    let member = state.data.chat.members.get_verified_member(args.caller)?;
    if !member.role().is_owner() {
        return Err(OCErrorCode::InitiatorNotAuthorized.into());
    }

    let now = state.env.now();
    let uninstalled_by = member.user_id();

    state.data.uninstall_bot(uninstalled_by, args.bot_id, now);

    state.push_bot_notification(Some(BotNotification {
        event: BotEvent::Lifecycle(BotLifecycleEvent::Uninstalled(BotUninstalledEvent {
            uninstalled_by,
            location: BotInstallationLocation::Group(state.env.canister_id().into()),
        })),
        recipients: vec![args.bot_id],
        timestamp: now,
    }));

    handle_activity_notification(state);
    Ok(())
}
