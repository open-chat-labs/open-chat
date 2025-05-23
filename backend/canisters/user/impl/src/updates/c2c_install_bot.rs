use crate::guards::caller_is_local_user_index;
use crate::{RuntimeState, execute_update};
use canister_api_macros::update;
use canister_tracing_macros::trace;
use oc_error_codes::OCErrorCode;
use rand::Rng;
use types::{
    BotEvent, BotInstallationLocation, BotInstalledEvent, BotLifecycleEvent, BotNotification, ChatEventCategory,
    c2c_install_bot::*,
};
use types::{OCResult, UserType};

#[update(guard = "caller_is_local_user_index", msgpack = true)]
#[trace]
fn c2c_install_bot(args: Args) -> Response {
    execute_update(|state| c2c_install_bot_impl(args, state)).into()
}

fn c2c_install_bot_impl(args: Args, state: &mut RuntimeState) -> OCResult {
    if args.caller != state.env.canister_id().into() {
        return Err(OCErrorCode::InitiatorNotAuthorized.into());
    };

    if state.data.suspended.value {
        return Err(OCErrorCode::InitiatorSuspended.into());
    }

    let now = state.env.now();

    if !state.data.bots.add(
        args.bot_id,
        args.caller,
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
        let permitted_categories = permissions.permitted_chat_event_categories_to_read();

        chat.events.subscribe_bot_to_events(
            args.bot_id,
            subscriptions
                .chat
                .into_iter()
                .filter(|t| permitted_categories.contains(&ChatEventCategory::from(*t)))
                .collect(),
        );
    }

    state.push_bot_notification(
        BotNotification {
            event: BotEvent::Lifecycle(BotLifecycleEvent::Installed(BotInstalledEvent {
                installed_by: args.caller,
                location: BotInstallationLocation::User(args.caller.into()),
                api_gateway: state.data.local_user_index_canister_id,
                granted_command_permissions: args.granted_permissions,
                granted_autonomous_permissions: args.granted_autonomous_permissions.unwrap_or_default(),
            })),
            recipients: vec![args.bot_id],
        },
        now,
    );

    Ok(())
}
