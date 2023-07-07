use crate::guards::caller_is_local_user_index_canister;
use crate::timer_job_types::{JoinUserToGroup, TimerJob};
use crate::{mutate_state, RuntimeState, ONE_MB};
use candid::Principal;
use canister_api_macros::update_msgpack;
use canister_tracing_macros::trace;
use local_user_index_canister::{
    Event as LocalUserIndexEvent, OpenChatBotMessage, UserJoinedCommunity, UserJoinedGroup, UserRegistered, UsernameChanged,
};
use storage_index_canister::add_or_update_users::UserConfig;
use types::{CanisterId, MessageContent, TextContent, UserId};
use user_index_canister::c2c_notify_events::{Response::*, *};
use user_index_canister::Event;

#[update_msgpack(guard = "caller_is_local_user_index_canister")]
#[trace]
fn c2c_notify_events(args: Args) -> Response {
    mutate_state(|state| c2c_notify_events_impl(args, state))
}

fn c2c_notify_events_impl(args: Args, state: &mut RuntimeState) -> Response {
    for event in args.events {
        handle_event(event, state);
    }

    Success
}

fn handle_event(event: Event, state: &mut RuntimeState) {
    let caller: CanisterId = state.env.caller();

    match event {
        Event::UserRegistered(ev) => process_new_user(ev.principal, ev.username, ev.user_id, ev.referred_by, caller, state),
        Event::UserJoinedGroup(ev) => {
            state.push_event_to_local_user_index(
                ev.user_id,
                LocalUserIndexEvent::UserJoinedGroup(UserJoinedGroup {
                    user_id: ev.user_id,
                    chat_id: ev.chat_id,
                    latest_message_index: ev.latest_message_index,
                }),
            );
        }
        Event::UserJoinedCommunity(ev) => {
            state.push_event_to_local_user_index(
                ev.user_id,
                LocalUserIndexEvent::UserJoinedCommunity(UserJoinedCommunity {
                    user_id: ev.user_id,
                    community_id: ev.community_id,
                }),
            );
        }
        Event::JoinUserToGroup(ev) => {
            let now = state.env.now();
            state.data.timer_jobs.enqueue_job(
                TimerJob::JoinUserToGroup(JoinUserToGroup {
                    user_id: ev.user_id,
                    group_id: ev.chat_id,
                    attempt: 0,
                }),
                now,
                now,
            );
        }
        Event::OpenChatBotMessage(ev) => {
            state.push_event_to_local_user_index(
                ev.user_id,
                LocalUserIndexEvent::OpenChatBotMessage(OpenChatBotMessage {
                    user_id: ev.user_id,
                    message: ev.message,
                }),
            );
        }
    }
}

fn process_new_user(
    caller: Principal,
    username: String,
    user_id: UserId,
    referred_by: Option<UserId>,
    local_user_index_canister_id: CanisterId,
    state: &mut RuntimeState,
) {
    let now = state.env.now();

    let mut original_username = None;
    let username = match state.data.users.ensure_unique_username(&username) {
        Ok(_) => username,
        Err(new_username) => {
            original_username = Some(username);
            new_username
        }
    };

    state
        .data
        .users
        .register(caller, user_id, username.clone(), now, referred_by, false);

    state.data.local_index_map.add_user(local_user_index_canister_id, user_id);

    state.push_event_to_all_local_user_indexes(
        LocalUserIndexEvent::UserRegistered(UserRegistered {
            user_id,
            user_principal: caller,
            username: username.clone(),
            is_bot: false,
            referred_by,
        }),
        Some(local_user_index_canister_id),
    );
    if let Some(original_username) = original_username {
        state.push_event_to_local_user_index(
            user_id,
            LocalUserIndexEvent::UsernameChanged(UsernameChanged {
                user_id,
                username: username.clone(),
            }),
        );
        state.push_event_to_local_user_index(
            user_id,
            LocalUserIndexEvent::OpenChatBotMessage(OpenChatBotMessage {
                user_id,
                message: MessageContent::Text(TextContent {
                    text: format!("Unfortunately the username \"{original_username}\" was taken so your username has been changed to \"{username}\".

You can change your username at any time by clicking \"Profile settings\" from the main menu.")
                }),
            }),
        );
    }

    state.data.storage_index_user_sync_queue.push(UserConfig {
        user_id: caller,
        byte_limit: 100 * ONE_MB,
    });

    crate::jobs::sync_users_to_storage_index::start_job_if_required(state);

    if let Some(referrer) = referred_by {
        state.data.user_referral_leaderboards.add_referral(referrer, now);
    }
}
