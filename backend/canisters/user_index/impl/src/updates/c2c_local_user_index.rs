use crate::guards::caller_is_local_user_index_canister;
use crate::{mutate_state, RuntimeState, UserRegisteredEventPayload};
use candid::Principal;
use canister_api_macros::update;
use canister_time::now_millis;
use canister_tracing_macros::trace;
use constants::ONE_MB;
use event_store_producer::EventBuilder;
use local_user_index_canister::{
    DeleteUser, OpenChatBotMessage, OpenChatBotMessageV2, UserIndexEvent, UserJoinedCommunityOrChannel, UserJoinedGroup,
    UserRegistered, UsernameChanged,
};
use std::cell::LazyCell;
use storage_index_canister::add_or_update_users::UserConfig;
use types::{CanisterId, MessageContent, TextContent, TimestampMillis, UserId, UserType};
use user_index_canister::c2c_local_user_index::{Response::*, *};
use user_index_canister::LocalUserIndexEvent;

#[update(guard = "caller_is_local_user_index_canister", msgpack = true)]
#[trace]
fn c2c_local_user_index(args: Args) -> Response {
    mutate_state(|state| c2c_local_user_index_impl(args, state))
}

fn c2c_local_user_index_impl(args: Args, state: &mut RuntimeState) -> Response {
    let caller: CanisterId = state.env.caller();
    let now = LazyCell::new(now_millis);
    for event in args.events {
        if state
            .data
            .idempotency_checker
            .check(caller, event.created_at, event.idempotency_id)
        {
            handle_event(event.value, caller, &now, state);
        }
    }

    Success
}

fn handle_event<F: FnOnce() -> TimestampMillis>(
    event: LocalUserIndexEvent,
    caller: Principal,
    now: &LazyCell<TimestampMillis, F>,
    state: &mut RuntimeState,
) {
    match event {
        LocalUserIndexEvent::UserRegistered(ev) => {
            process_new_user(ev.principal, ev.username, ev.user_id, ev.referred_by, caller, state)
        }
        LocalUserIndexEvent::UserJoinedGroup(ev) => {
            state.push_event_to_local_user_index(
                ev.user_id,
                UserIndexEvent::UserJoinedGroup(UserJoinedGroup {
                    user_id: ev.user_id,
                    chat_id: ev.chat_id,
                    local_user_index_canister_id: ev.local_user_index_canister_id,
                    latest_message_index: ev.latest_message_index,
                    group_canister_timestamp: ev.group_canister_timestamp,
                }),
            );
        }
        LocalUserIndexEvent::UserJoinedCommunityOrChannel(ev) => {
            state.push_event_to_local_user_index(
                ev.user_id,
                UserIndexEvent::UserJoinedCommunityOrChannel(UserJoinedCommunityOrChannel {
                    user_id: ev.user_id,
                    community_id: ev.community_id,
                    local_user_index_canister_id: ev.local_user_index_canister_id,
                    channels: ev.channels,
                    community_canister_timestamp: ev.community_canister_timestamp,
                }),
            );
        }
        LocalUserIndexEvent::OpenChatBotMessage(ev) => {
            state.push_event_to_local_user_index(
                ev.user_id,
                UserIndexEvent::OpenChatBotMessage(Box::new(OpenChatBotMessage {
                    user_id: ev.user_id,
                    message: ev.message,
                })),
            );
        }
        LocalUserIndexEvent::OpenChatBotMessageV2(ev) => {
            state.push_event_to_local_user_index(
                ev.user_id,
                UserIndexEvent::OpenChatBotMessageV2(Box::new(OpenChatBotMessageV2 {
                    user_id: ev.user_id,
                    thread_root_message_id: ev.thread_root_message_id,
                    content: ev.content,
                    mentioned: ev.mentioned,
                })),
            );
        }
        LocalUserIndexEvent::UserDeleted(ev) => {
            state.delete_user(ev.user_id, false);
            state.push_event_to_all_local_user_indexes(
                UserIndexEvent::DeleteUser(DeleteUser {
                    user_id: ev.user_id,
                    triggered_by_user: false,
                }),
                Some(caller),
            );
        }
        LocalUserIndexEvent::NotifyUniquePersonProof(ev) => {
            let (user_id, proof) = *ev;
            state
                .data
                .users
                .record_proof_of_unique_personhood(user_id, proof.clone(), **now);
            state.push_event_to_all_local_user_indexes(UserIndexEvent::NotifyUniquePersonProof(user_id, proof), Some(caller));
        }
        LocalUserIndexEvent::NotifyChit(ev) => {
            let (user_id, chit) = *ev;

            if state.data.users.set_chit(
                &user_id,
                chit.timestamp,
                chit.chit_balance,
                chit.streak,
                chit.streak_ends,
                **now,
            ) {
                if let Some(user) = state.data.users.get_by_user_id(&user_id) {
                    state.data.chit_leaderboard.update_position(
                        user_id,
                        user.total_chit_earned(),
                        chit.chit_balance,
                        chit.timestamp,
                        **now,
                    );
                }
            }
        }
        LocalUserIndexEvent::NotifyStreakInsurancePayment(payment) => state.data.streak_insurance_logs.mark_payment(*payment),
        LocalUserIndexEvent::NotifyStreakInsuranceClaim(claim) => state.data.streak_insurance_logs.mark_claim(*claim),
        LocalUserIndexEvent::BotInstalled(ev) => {
            state
                .data
                .users
                .add_bot_installation(ev.bot_id, ev.location, caller, ev.installed_by, **now);
        }
        LocalUserIndexEvent::BotUninstalled(ev) => {
            state.data.users.remove_bot_installation(ev.bot_id, &ev.location);
        }
        LocalUserIndexEvent::UserBlocked(user_id, blocked) => state.push_event_to_notifications_index(
            notifications_index_canister::UserIndexEvent::UserBlocked(user_id, blocked),
            **now,
        ),
        LocalUserIndexEvent::UserUnblocked(user_id, unblocked) => state.push_event_to_notifications_index(
            notifications_index_canister::UserIndexEvent::UserUnblocked(user_id, unblocked),
            **now,
        ),
        LocalUserIndexEvent::SetMaxStreak(user_id, max_streak) => state.data.users.set_max_streak(&user_id, max_streak),
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
    let username = match state.data.users.ensure_unique_username(&username, false) {
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
        UserIndexEvent::UserRegistered(UserRegistered {
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
            UserIndexEvent::UsernameChanged(UsernameChanged {
                user_id,
                username: username.clone(),
            }),
        );
        state.push_event_to_local_user_index(
            user_id,
            UserIndexEvent::OpenChatBotMessage(Box::new(OpenChatBotMessage {
                user_id,
                message: MessageContent::Text(TextContent {
                    text: format!("Unfortunately the username \"{original_username}\" was taken so your username has been changed to \"{username}\".

You can change your username at any time by clicking \"Profile settings\" from the main menu.")
                }),
            })),
        );
    }

    state.data.storage_index_user_sync_queue.push(
        state.data.storage_index_canister_id,
        UserConfig {
            user_id: principal,
            byte_limit: 100 * ONE_MB,
        },
    );

    state
        .data
        .identity_canister_user_sync_queue
        .push_back((principal, Some(user_id)));

    crate::jobs::sync_users_to_identity_canister::try_run_now(state);
}
