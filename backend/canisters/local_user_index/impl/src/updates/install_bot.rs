use crate::{RuntimeState, UserIndexEvent, guards::caller_is_openchat_user, mutate_state, read_state};
use canister_api_macros::update;
use canister_client::generate_c2c_call;
use canister_tracing_macros::trace;
use local_user_index_canister::install_bot::*;
use oc_error_codes::{OCError, OCErrorCode};
use types::{
    BotEvent, BotInstalledEvent, BotLifecycleEvent, BotNotification, BotRegistrationStatus, BotSubscriptions, OCResult, UserId,
    c2c_install_bot,
};

#[update(guard = "caller_is_openchat_user", msgpack = true)]
#[trace]
async fn install_bot(args: Args) -> Response {
    install_bot_impl(args).await.into()
}

async fn install_bot_impl(args: Args) -> OCResult {
    let PrepareResult {
        user_id,
        default_subscriptions,
    } = read_state(|state| prepare(&args, state))?;

    let response = c2c_install_bot(
        args.location.canister_id(),
        &c2c_install_bot::Args {
            bot_id: args.bot_id,
            caller: user_id,
            granted_permissions: args.granted_permissions.clone(),
            granted_autonomous_permissions: args.granted_autonomous_permissions.clone(),
            default_subscriptions,
        },
    )
    .await?;

    if let Response::Error(error) = response {
        return Err(error);
    }

    mutate_state(|state| {
        let now = state.env.now();

        state.push_event_to_user_index(
            UserIndexEvent::BotInstalled(Box::new(user_index_canister::BotInstalled {
                bot_id: args.bot_id,
                location: args.location,
                installed_by: user_id,
                granted_permissions: args.granted_permissions.clone(),
                granted_autonomous_permissions: args.granted_autonomous_permissions.clone().unwrap_or_default(),
            })),
            now,
        );

        state.push_bot_notification(
            BotNotification {
                event: BotEvent::Lifecycle(BotLifecycleEvent::Installed(BotInstalledEvent {
                    installed_by: user_id,
                    location: args.location,
                    granted_command_permissions: args.granted_permissions,
                    granted_autonomous_permissions: args.granted_autonomous_permissions.unwrap_or_default(),
                })),
                recipients: vec![args.bot_id],
                timestamp: now,
            },
            state.env.canister_id(),
            now,
        );
    });

    Ok(())
}

struct PrepareResult {
    user_id: UserId,
    default_subscriptions: Option<BotSubscriptions>,
}

fn prepare(args: &Args, state: &RuntimeState) -> Result<PrepareResult, OCError> {
    let caller = state.env.caller();
    let user = state.data.global_users.get(&caller).unwrap();
    let bot = state.data.bots.get(&args.bot_id).ok_or(OCErrorCode::BotNotFound)?;

    match bot.registration_status {
        BotRegistrationStatus::Public => (),
        BotRegistrationStatus::Private(location) => {
            if location.is_none_or(|loc| loc != args.location) && bot.owner_id != user.user_id {
                return Err(OCErrorCode::InitiatorNotAuthorized.into());
            }
        }
    }

    Ok(PrepareResult {
        user_id: user.user_id,
        default_subscriptions: bot.default_subscriptions.clone(),
    })
}

generate_c2c_call!(c2c_install_bot);
