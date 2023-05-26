use crate::{mutate_state, read_state, RuntimeState};
use candid::Principal;
use canister_api_macros::update_msgpack;
use canister_tracing_macros::trace;
use notifications_canister::c2c_push_notification::{Response::*, *};
use types::{CanPushNotificationsArgs, CanPushNotificationsResponse, CanisterId, NotificationEnvelope, UserId};

#[update_msgpack]
#[trace]
async fn c2c_push_notification(args: Args) -> Response {
    match read_state(|state| can_push_notifications(&args, state)) {
        CanPushNotificationsResult::Blocked => return Blocked,
        CanPushNotificationsResult::Unknown(caller, authorizer) => {
            match check_if_caller_is_authorized(caller, authorizer).await {
                Ok(authorized) => {
                    mutate_state(|state| state.data.authorized_principals.add_principal(caller, authorized));
                    if !authorized {
                        return Blocked;
                    }
                }
                Err(response) => return response,
            }
        }
        _ => {}
    }

    mutate_state(|state| c2c_push_notification_impl(args.recipients, args.notification_bytes, state))
}

enum CanPushNotificationsResult {
    Authorized,
    Blocked,
    Unknown(Principal, CanisterId), // (Caller, Authorizer)
}

fn can_push_notifications(args: &Args, state: &RuntimeState) -> CanPushNotificationsResult {
    let caller = state.env.caller();
    if let Some(authorized) = state.data.authorized_principals.can_push_notifications(&caller) {
        if authorized {
            return CanPushNotificationsResult::Authorized;
        }
    } else if let Some(authorizer) = args.authorizer {
        if state.data.authorized_principals.is_authorizer(&authorizer) {
            return CanPushNotificationsResult::Unknown(caller, authorizer);
        }
    }
    CanPushNotificationsResult::Blocked
}

fn c2c_push_notification_impl(recipients: Vec<UserId>, notification_bytes: Vec<u8>, state: &mut RuntimeState) -> Response {
    let filtered_recipients: Vec<_> = recipients
        .into_iter()
        .filter(|u| state.data.subscriptions.any_for_user(u))
        .collect();

    if !filtered_recipients.is_empty() {
        state.data.notifications.add(NotificationEnvelope {
            recipients: filtered_recipients,
            notification_bytes,
            timestamp: state.env.now(),
        });
    }
    Success
}

async fn check_if_caller_is_authorized(caller: Principal, authorizer: CanisterId) -> Result<bool, Response> {
    let args = CanPushNotificationsArgs { principal: caller };

    match c2c_can_push_notifications(authorizer, &args).await {
        Ok(CanPushNotificationsResponse::Success(authorized)) => Ok(authorized),
        Err(error) => Err(InternalError(format!("{error:?}"))),
    }
}

mod c2c_can_push_notifications {
    use types::{CanPushNotificationsArgs, CanPushNotificationsResponse};

    pub type Args = CanPushNotificationsArgs;
    pub type Response = CanPushNotificationsResponse;
}

canister_client::generate_c2c_call!(c2c_can_push_notifications);
