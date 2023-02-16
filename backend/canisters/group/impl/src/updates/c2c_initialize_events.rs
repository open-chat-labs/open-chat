use crate::guards::caller_is_local_group_index;
use crate::model::participants::Participants;
use crate::timer_job_types::{EndPollJob, HardDeleteMessageContentJob, TimerJob};
use crate::{mutate_state, run_regular_jobs, RuntimeState};
use candid::Principal;
use canister_api_macros::update_msgpack;
use canister_timer_jobs::TimerJobs;
use canister_tracing_macros::trace;
use chat_events::{ChatEventInternal, ChatEventsListReader, MessageInternal, Reader};
use group_canister::c2c_initialize_events::{Response::*, *};
use std::collections::HashMap;
use types::{
    EventIndex, GroupPermissions, MentionInternal, MessageContentInternal, MessageIndex, PermissionRole, Role, TimestampMillis,
    UserId,
};
use utils::mentions::extract_mentioned_users;
use utils::time::MINUTE_IN_MS;

#[update_msgpack(guard = "caller_is_local_group_index")]
#[trace]
fn c2c_initialize_events(args: Args) -> Response {
    run_regular_jobs();

    mutate_state(|state| c2c_initialize_events_impl(args, state))
}

fn c2c_initialize_events_impl(args: Args, runtime_state: &mut RuntimeState) -> Response {
    if runtime_state.data.initialized {
        panic!("AlreadyInitialized");
    }

    // Skip the GroupChatCreated event since it has already been added
    for event in args
        .events
        .into_iter()
        .skip_while(|e| matches!(e.event, ChatEventInternal::GroupChatCreated(_)))
    {
        let result = runtime_state
            .data
            .events
            .push_main_event(event.event, event.correlation_id, event.timestamp);

        if result.index != event.index {
            panic!("EventIndex mismatch. Actual: {}. Expected: {}", result.index, event.index);
        }
    }

    for (message_index, events) in args.thread_events {
        for event in events {
            let result =
                runtime_state
                    .data
                    .events
                    .push_thread_event(message_index, event.event, event.correlation_id, event.timestamp);

            if result != event.index {
                panic!(
                    "Thread EventIndex mismatch. Root: {message_index:?}. Actual: {result}. Expected: {}",
                    event.index
                );
            }
        }
    }

    if args.is_complete {
        assert!(!args.user_principals.is_empty());
        process_completed_events(args.user_principals, runtime_state);
    }
    Success
}

fn process_completed_events(user_principals: HashMap<UserId, Principal>, runtime_state: &mut RuntimeState) {
    let now = runtime_state.env.now();
    let temp_permissions = GroupPermissions {
        change_roles: PermissionRole::Members,
        ..Default::default()
    };
    let mut next_message_index = MessageIndex::default();
    let mut threads = Vec::new();
    let main_events_reader = runtime_state.data.events.main_events_reader(now);
    for event_wrapper in main_events_reader.iter(None, true) {
        match &event_wrapper.event {
            ChatEventInternal::Message(m) => {
                if let Some(thread) = m.thread_summary.as_ref() {
                    threads.push(m.message_index);
                    for user_id in thread.participant_ids.iter().chain([&m.sender]) {
                        runtime_state.data.participants.add_thread(user_id, m.message_index);
                    }
                }
                process_mentions(
                    None,
                    m,
                    event_wrapper.timestamp,
                    &main_events_reader,
                    &mut runtime_state.data.participants,
                );
                setup_timer_jobs(m, None, now, &mut runtime_state.data.timer_jobs);
                next_message_index = m.message_index.incr();
            }
            ChatEventInternal::ParticipantsAdded(p) => {
                for user_id in p.user_ids.iter() {
                    runtime_state.data.participants.add(
                        *user_id,
                        get_principal(user_id, &user_principals),
                        event_wrapper.timestamp,
                        if runtime_state.data.history_visible_to_new_joiners || event_wrapper.index <= EventIndex::from(1) {
                            EventIndex::default()
                        } else {
                            event_wrapper.index
                        },
                        if runtime_state.data.history_visible_to_new_joiners || event_wrapper.index <= EventIndex::from(1) {
                            MessageIndex::default()
                        } else {
                            next_message_index
                        },
                        false,
                        true,
                    );
                }
            }
            ChatEventInternal::ParticipantsRemoved(p) => {
                for user_id in p.user_ids.iter() {
                    runtime_state.data.participants.remove(*user_id);
                }
            }
            ChatEventInternal::ParticipantJoined(p) => {
                runtime_state.data.participants.add(
                    p.user_id,
                    get_principal(&p.user_id, &user_principals),
                    event_wrapper.timestamp,
                    if runtime_state.data.history_visible_to_new_joiners || event_wrapper.index <= EventIndex::from(1) {
                        EventIndex::default()
                    } else {
                        event_wrapper.index
                    },
                    if runtime_state.data.history_visible_to_new_joiners || event_wrapper.index <= EventIndex::from(1) {
                        MessageIndex::default()
                    } else {
                        next_message_index
                    },
                    p.as_super_admin,
                    true,
                );
            }
            ChatEventInternal::ParticipantLeft(p) => {
                runtime_state.data.participants.remove(p.user_id);
            }
            ChatEventInternal::ParticipantAssumesSuperAdmin(p) => {
                runtime_state.data.participants.make_super_admin(&p.user_id);
            }
            ChatEventInternal::ParticipantDismissedAsSuperAdmin(p) => {
                runtime_state.data.participants.dismiss_super_admin(&p.user_id);
            }
            ChatEventInternal::ParticipantRelinquishesSuperAdmin(p) => {
                runtime_state.data.participants.dismiss_super_admin(&p.user_id);
            }
            ChatEventInternal::RoleChanged(r) => {
                for user_id in r.user_ids.iter() {
                    runtime_state.data.participants.change_role(
                        get_principal(&r.changed_by, &user_principals),
                        user_id,
                        r.new_role,
                        &temp_permissions,
                    );
                }
            }
            ChatEventInternal::OwnershipTransferred(o) => {
                runtime_state.data.participants.change_role(
                    get_principal(&o.old_owner, &user_principals),
                    &o.new_owner,
                    Role::Owner,
                    &temp_permissions,
                );
            }
            ChatEventInternal::UsersBlocked(u) => {
                for user_id in u.user_ids.iter() {
                    runtime_state.data.participants.block(*user_id);
                    runtime_state.data.participants.remove(*user_id);
                }
            }
            ChatEventInternal::UsersUnblocked(u) => {
                for user_id in u.user_ids.iter() {
                    runtime_state.data.participants.unblock(user_id);
                }
            }
            ChatEventInternal::MessagePinned(p) => {
                let index = runtime_state
                    .data
                    .pinned_messages
                    .binary_search(&p.message_index)
                    .err()
                    .unwrap_or_else(|| panic!("Data inconsistency. Message already pinned. {}", event_wrapper.index));
                runtime_state.data.pinned_messages.insert(index, p.message_index);
                runtime_state.data.date_last_pinned = Some(event_wrapper.timestamp);
            }
            ChatEventInternal::MessageUnpinned(u) => {
                let index = runtime_state
                    .data
                    .pinned_messages
                    .binary_search(&u.message_index)
                    .unwrap_or_else(|_| panic!("Data inconsistency. Pinned message not found. {}", event_wrapper.index));
                runtime_state.data.pinned_messages.remove(index);
                if runtime_state.data.pinned_messages.is_empty() {
                    runtime_state.data.date_last_pinned = None;
                }
            }
            ChatEventInternal::MessageEdited(_)
            | ChatEventInternal::MessageDeleted(_)
            | ChatEventInternal::MessageUndeleted(_)
            | ChatEventInternal::MessageReactionAdded(_)
            | ChatEventInternal::MessageReactionRemoved(_)
            | ChatEventInternal::DirectChatCreated(_)
            | ChatEventInternal::GroupChatCreated(_)
            | ChatEventInternal::GroupNameChanged(_)
            | ChatEventInternal::GroupDescriptionChanged(_)
            | ChatEventInternal::GroupRulesChanged(_)
            | ChatEventInternal::AvatarChanged(_)
            | ChatEventInternal::PollVoteRegistered(_)
            | ChatEventInternal::PollVoteDeleted(_)
            | ChatEventInternal::PollEnded(_)
            | ChatEventInternal::PermissionsChanged(_)
            | ChatEventInternal::GroupVisibilityChanged(_)
            | ChatEventInternal::GroupInviteCodeChanged(_)
            | ChatEventInternal::ThreadUpdated(_)
            | ChatEventInternal::ProposalsUpdated(_)
            | ChatEventInternal::ChatFrozen(_)
            | ChatEventInternal::ChatUnfrozen(_)
            | ChatEventInternal::EventsTimeToLiveUpdated(_) => {}
        }
    }

    for root_message_index in threads {
        if let Some(events_reader) =
            runtime_state
                .data
                .events
                .events_reader(EventIndex::default(), Some(root_message_index), now)
        {
            for event_wrapper in events_reader.iter(None, true) {
                if let Some(m) = &event_wrapper.event.as_message() {
                    // The first thread reply counts as a mention for the root message sender
                    if m.message_index == MessageIndex::default() {
                        if let Some(user_id) = main_events_reader.message_internal(m.message_index.into()).map(|m| m.sender) {
                            add_mention(
                                Some(root_message_index),
                                MessageIndex::default(),
                                &user_id,
                                event_wrapper.timestamp,
                                &mut runtime_state.data.participants,
                            );
                        }
                    }
                    process_mentions(
                        Some(root_message_index),
                        m,
                        event_wrapper.timestamp,
                        &events_reader,
                        &mut runtime_state.data.participants,
                    );
                    setup_timer_jobs(m, Some(root_message_index), now, &mut runtime_state.data.timer_jobs);
                }
            }
        }
    }

    runtime_state.data.initialized = true;
}

fn process_mentions(
    thread_root_message_index: Option<MessageIndex>,
    message: &MessageInternal,
    timestamp: TimestampMillis,
    events_reader: &ChatEventsListReader,
    participants: &mut Participants,
) {
    let mut mentioned_users = Vec::new();
    if let Some(text) = message.content.text() {
        mentioned_users.extend(extract_mentioned_users(text));
    }

    if let Some(user_id) = message
        .replies_to
        .as_ref()
        .filter(|r| r.chat_id_if_other.is_none())
        .and_then(|r| events_reader.message_internal(r.event_index.into()))
        .map(|m| m.sender)
    {
        mentioned_users.push(user_id);
    }

    for user_id in mentioned_users {
        add_mention(
            thread_root_message_index,
            message.message_index,
            &user_id,
            timestamp,
            participants,
        );
    }
}

fn add_mention(
    thread_root_message_index: Option<MessageIndex>,
    message_index: MessageIndex,
    user_id: &UserId,
    timestamp: TimestampMillis,
    participants: &mut Participants,
) {
    if let Some(p) = participants.get_by_user_id_mut(user_id) {
        p.mentions_v2.add(
            MentionInternal {
                thread_root_message_index,
                message_index,
            },
            timestamp,
        );
    }
}

fn setup_timer_jobs(
    message: &MessageInternal,
    thread_root_message_index: Option<MessageIndex>,
    now: TimestampMillis,
    timer_jobs: &mut TimerJobs<TimerJob>,
) {
    match &message.content {
        MessageContentInternal::Poll(p) if !p.ended => {
            timer_jobs.enqueue_job(
                TimerJob::EndPoll(EndPollJob {
                    thread_root_message_index,
                    message_index: message.message_index,
                }),
                p.config.end_date.unwrap_or(now),
                now,
            );
        }
        _ => {}
    };
    if let Some(deleted_by) = &message.deleted_by {
        if !matches!(message.content, MessageContentInternal::Deleted(_)) {
            timer_jobs.enqueue_job(
                TimerJob::HardDeleteMessageContent(HardDeleteMessageContentJob {
                    thread_root_message_index,
                    message_id: message.message_id,
                }),
                deleted_by.timestamp + (5 * MINUTE_IN_MS),
                now,
            )
        }
    }
}

fn get_principal(user_id: &UserId, map: &HashMap<UserId, Principal>) -> Principal {
    *map.get(user_id)
        .unwrap_or_else(|| panic!("Principal not found for user {user_id}"))
}
