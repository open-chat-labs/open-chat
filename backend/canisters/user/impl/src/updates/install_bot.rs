use crate::guards::caller_is_local_user_index;
use crate::{RuntimeState, execute_update};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use oc_error_codes::OCErrorCode;
use rand::Rng;
use types::{
    BotEvent, BotInstallationLocation, BotInstalledEvent, BotLifecycleEvent, BotNotification, UserId, c2c_install_bot,
    install_bot::*,
};
use types::{OCResult, UserType};

#[update(msgpack = true)]
#[trace]
fn install_bot(args: Args) -> Response {
    execute_update(|state| {
        install_bot_impl(
            c2c_install_bot::Args {
                bot_id: args.bot_id,
                caller: state.env.caller().into(),
                granted_permissions: args.granted_permissions,
                granted_autonomous_permissions: args.granted_autonomous_permissions,
                default_subscriptions: args.default_subscriptions,
            },
            state,
        )
    })
    .into()
}

// TODO: remove this once user canisters have been upgraded
#[update(guard = "caller_is_local_user_index", msgpack = true)]
#[trace]
fn c2c_install_bot(args: c2c_install_bot::Args) -> Response {
    execute_update(|state| install_bot_impl(args, state)).into()
}

fn install_bot_impl(args: c2c_install_bot::Args, state: &mut RuntimeState) -> OCResult {
    let user_id: UserId = state.env.canister_id().into();

    if args.caller != user_id && args.caller != state.data.owner.into() {
        return Err(OCErrorCode::InitiatorNotAuthorized.into());
    };

    if state.data.suspended.value {
        return Err(OCErrorCode::InitiatorSuspended.into());
    }

    let now = state.env.now();

    if !state.data.bots.add(
        args.bot_id,
        user_id,
        args.granted_permissions.clone(),
        args.granted_autonomous_permissions.clone(),
        args.default_subscriptions.clone(),
        now,
    ) {
        return Err(OCErrorCode::AlreadyAdded.into());
    }

    // If there isn't already a direct chat with the bot, create one now
    let chat = state
        .data
        .direct_chats
        .get_or_create(args.bot_id, UserType::BotV2, || state.env.rng().r#gen(), now);

    // Subscribe to permitted chat events
    if let (Some(subscriptions), Some(permissions)) = (args.default_subscriptions, args.granted_autonomous_permissions.clone())
    {
        chat.events.subscribe_bot_to_events(
            args.bot_id,
            subscriptions.chat,
            &permissions.permitted_chat_event_categories_to_read(),
        );
    }

    state.push_bot_notification(Some(BotNotification {
        event: BotEvent::Lifecycle(BotLifecycleEvent::Installed(BotInstalledEvent {
            installed_by: user_id,
            location: BotInstallationLocation::User(user_id.into()),
            granted_command_permissions: args.granted_permissions,
            granted_autonomous_permissions: args.granted_autonomous_permissions.unwrap_or_default(),
        })),
        recipients: vec![args.bot_id],
        timestamp: now,
    }));

    Ok(())
}
