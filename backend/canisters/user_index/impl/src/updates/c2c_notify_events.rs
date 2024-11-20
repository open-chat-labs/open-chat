use crate::guards::caller_is_local_user_index_canister;
use crate::timer_job_types::{JoinUserToGroup, TimerJob};
use crate::{mutate_state, RuntimeState, UserRegisteredEventPayload, ONE_MB};
use candid::Principal;
use canister_api_macros::update;
use canister_tracing_macros::trace;
use event_store_producer::EventBuilder;
use local_user_index_canister::{
    DeleteUser, Event as LocalUserIndexEvent, OpenChatBotMessage, OpenChatBotMessageV2, UserJoinedCommunityOrChannel,
    UserJoinedGroup, UserRegistered, UsernameChanged,
};
use storage_index_canister::add_or_update_users::UserConfig;
use types::{CanisterId, MessageContent, TextContent, UserId, UserType};
use user_index_canister::c2c_notify_events::{Response::*, *};
use user_index_canister::Event;

#[update(guard = "caller_is_local_user_index_canister", msgpack = true)]
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
                    local_user_index_canister_id: ev.local_user_index_canister_id,
                    latest_message_index: ev.latest_message_index,
                    group_canister_timestamp: ev.group_canister_timestamp,
                }),
            );
        }
        Event::UserJoinedCommunityOrChannel(ev) => {
            state.push_event_to_local_user_index(
                ev.user_id,
                LocalUserIndexEvent::UserJoinedCommunityOrChannel(UserJoinedCommunityOrChannel {
                    user_id: ev.user_id,
                    community_id: ev.community_id,
                    local_user_index_canister_id: ev.local_user_index_canister_id,
                    channels: ev.channels,
                    community_canister_timestamp: ev.community_canister_timestamp,
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
                LocalUserIndexEvent::OpenChatBotMessage(Box::new(OpenChatBotMessage {
                    user_id: ev.user_id,
                    message: ev.message,
                })),
            );
        }
        Event::OpenChatBotMessageV2(ev) => {
            state.push_event_to_local_user_index(
                ev.user_id,
                LocalUserIndexEvent::OpenChatBotMessageV2(Box::new(OpenChatBotMessageV2 {
                    user_id: ev.user_id,
                    thread_root_message_id: ev.thread_root_message_id,
                    content: ev.content,
                    mentioned: ev.mentioned,
                })),
            );
        }
        Event::UserDeleted(ev) => {
            state.delete_user(ev.user_id, false);
            state.push_event_to_all_local_user_indexes(
                LocalUserIndexEvent::DeleteUser(DeleteUser {
                    user_id: ev.user_id,
                    triggered_by_user: false,
                }),
                Some(caller),
            );
        }
        Event::NotifyUniquePersonProof(ev) => {
            let (user_id, proof) = *ev;
            state
                .data
                .users
                .record_proof_of_unique_personhood(user_id, proof.clone(), state.env.now());
            state.push_event_to_all_local_user_indexes(
                LocalUserIndexEvent::NotifyUniquePersonProof(user_id, proof),
                Some(caller),
            );
        }
    }
}

fn process_new_user(
    principal: Principal,
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

    state.data.users.register(
        principal,
        user_id,
        username.clone(),
        None,
        now,
        referred_by,
        UserType::User,
        None,
    );

    state.data.local_index_map.add_user(local_user_index_canister_id, user_id);

    state.push_event_to_all_local_user_indexes(
        LocalUserIndexEvent::UserRegistered(UserRegistered {
            user_id,
            user_principal: principal,
            username: username.clone(),
            user_type: UserType::User,
            referred_by,
        }),
        Some(local_user_index_canister_id),
    );

    state.data.event_store_client.push(
        EventBuilder::new("user_registered", now)
            .with_user(user_id.to_string(), true)
            .with_source(state.env.canister_id().to_string(), false)
            .with_json_payload(&UserRegisteredEventPayload {
                referred: referred_by.is_some(),
                is_bot: false,
            })
            .build(),
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
            LocalUserIndexEvent::OpenChatBotMessage(Box::new(OpenChatBotMessage {
                user_id,
                message: MessageContent::Text(TextContent {
                    text: format!("Unfortunately the username \"{original_username}\" was taken so your username has been changed to \"{username}\".

You can change your username at any time by clicking \"Profile settings\" from the main menu.")
                }),
            })),
        );
    }

    state.data.storage_index_user_sync_queue.push(UserConfig {
        user_id: principal,
        byte_limit: 100 * ONE_MB,
    });
    crate::jobs::sync_users_to_storage_index::try_run_now(state);

    state
        .data
        .identity_canister_user_sync_queue
        .push_back((principal, Some(user_id)));

    crate::jobs::sync_users_to_identity_canister::try_run_now(state);
}
