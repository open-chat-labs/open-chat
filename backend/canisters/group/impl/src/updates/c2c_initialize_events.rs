use crate::guards::caller_is_group_index;
use crate::model::participants::Participants;
use crate::updates::c2c_unfreeze_group::c2c_unfreeze_group_impl;
use crate::{mutate_state, run_regular_jobs, RuntimeState};
use candid::Principal;
use canister_api_macros::update_msgpack;
use canister_tracing_macros::trace;
use chat_events::{ChatEventInternal, Reader};
use group_canister::c2c_initialize_events::{Response::*, *};
use std::collections::HashMap;
use types::{EventIndex, GroupPermissions, MessageIndex, PermissionRole, Role, UserId};

#[update_msgpack(guard = "caller_is_group_index")]
#[trace]
async fn c2c_initialize_events(args: Args) -> Response {
    run_regular_jobs();

    mutate_state(|state| c2c_initialize_events_impl(args, state))
}

fn c2c_initialize_events_impl(args: Args, runtime_state: &mut RuntimeState) -> Response {
    if runtime_state.data.initialized {
        panic!("AlreadyInitialized");
    }

    for event in args.events {
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
    let temp_permissions = everything_allowed_permissions();
    let mut participants = Participants::default();
    let mut next_message_index = MessageIndex::default();
    for event_wrapper in runtime_state.data.events.main_events_reader(now).iter(None, true) {
        match &event_wrapper.event {
            ChatEventInternal::Message(m) => {
                next_message_index = m.message_index.incr()
                // TODO check if is poll
            }
            ChatEventInternal::ParticipantsAdded(p) => {
                for user_id in p.user_ids.iter() {
                    participants.add(
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
                    participants.remove(*user_id);
                }
            }
            ChatEventInternal::ParticipantJoined(p) => {
                participants.add(
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
                participants.remove(p.user_id);
            }
            ChatEventInternal::ParticipantAssumesSuperAdmin(p) => {
                participants.make_super_admin(&p.user_id);
            }
            ChatEventInternal::ParticipantDismissedAsSuperAdmin(p) => {
                participants.dismiss_super_admin(&p.user_id);
            }
            ChatEventInternal::ParticipantRelinquishesSuperAdmin(p) => {
                participants.dismiss_super_admin(&p.user_id);
            }
            ChatEventInternal::RoleChanged(r) => {
                for user_id in r.user_ids.iter() {
                    participants.change_role(
                        get_principal(&r.changed_by, &user_principals),
                        user_id,
                        r.new_role,
                        &temp_permissions,
                    );
                }
            }
            ChatEventInternal::OwnershipTransferred(o) => {
                participants.change_role(
                    get_principal(&o.old_owner, &user_principals),
                    &o.new_owner,
                    Role::Owner,
                    &temp_permissions,
                );
            }
            ChatEventInternal::UsersBlocked(u) => {
                for user_id in u.user_ids.iter() {
                    participants.block(*user_id);
                }
            }
            ChatEventInternal::UsersUnblocked(u) => {
                for user_id in u.user_ids.iter() {
                    participants.unblock(user_id);
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

    c2c_unfreeze_group_impl(
        group_canister::c2c_unfreeze_group::Args {
            caller: runtime_state.env.caller().into(),
        },
        runtime_state,
    );
    runtime_state.data.initialized = true;
}

fn get_principal(user_id: &UserId, map: &HashMap<UserId, Principal>) -> Principal {
    *map.get(user_id)
        .unwrap_or_else(|| panic!("Principal not found for user {user_id}"))
}

fn everything_allowed_permissions() -> GroupPermissions {
    GroupPermissions {
        change_permissions: PermissionRole::Members,
        change_roles: PermissionRole::Members,
        add_members: PermissionRole::Members,
        remove_members: PermissionRole::Members,
        block_users: PermissionRole::Members,
        delete_messages: PermissionRole::Members,
        update_group: PermissionRole::Members,
        pin_messages: PermissionRole::Members,
        invite_users: PermissionRole::Members,
        create_polls: PermissionRole::Members,
        send_messages: PermissionRole::Members,
        react_to_messages: PermissionRole::Members,
        reply_in_thread: PermissionRole::Members,
    }
}
