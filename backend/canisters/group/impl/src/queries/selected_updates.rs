use crate::{read_state, Data, RuntimeState};
use chat_events::ChatEventInternal;
use group_canister::selected_updates::{Response::*, *};
use ic_cdk_macros::query;
use std::collections::HashSet;
use types::UserId;

#[query]
fn selected_updates(args: Args) -> Response {
    read_state(|state| selected_updates_impl(args, state))
}

fn selected_updates_impl(args: Args, runtime_state: &RuntimeState) -> Response {
    if !runtime_state.is_caller_participant() {
        return CallerNotInGroup;
    }

    let data = &runtime_state.data;
    let latest_event_index = data.events.main.last().index;

    if latest_event_index <= args.updates_since {
        return SuccessNoUpdates(latest_event_index);
    }

    let mut result = SuccessResult {
        latest_event_index,
        participants_added_or_updated: vec![],
        participants_removed: vec![],
        blocked_users_added: vec![],
        blocked_users_removed: vec![],
        pinned_messages_added: vec![],
        pinned_messages_removed: vec![],
    };

    let mut user_updates_handler = UserUpdatesHandler {
        data,
        users_updated: HashSet::new(),
    };

    // Iterate through the new events starting from most recent
    for event_wrapper in data.events.main.since(args.updates_since).iter().rev() {
        match &event_wrapper.event {
            ChatEventInternal::OwnershipTransferred(e) => {
                user_updates_handler.mark_participant_updated(&mut result, e.old_owner, false);
                user_updates_handler.mark_participant_updated(&mut result, e.new_owner, false);
            }
            ChatEventInternal::ParticipantsAdded(p) => {
                for user_id in p.user_ids.iter() {
                    user_updates_handler.mark_participant_updated(&mut result, *user_id, false);
                }
                for user_id in p.unblocked.iter() {
                    user_updates_handler.mark_user_blocked_updated(&mut result, *user_id, false);
                }
            }
            ChatEventInternal::ParticipantsRemoved(p) => {
                for user_id in p.user_ids.iter() {
                    user_updates_handler.mark_participant_updated(&mut result, *user_id, true);
                }
            }
            ChatEventInternal::ParticipantJoined(p) => {
                user_updates_handler.mark_participant_updated(&mut result, p.user_id, false);
            }
            ChatEventInternal::ParticipantLeft(p) => {
                user_updates_handler.mark_participant_updated(&mut result, p.user_id, true);
            }
            ChatEventInternal::ParticipantAssumesSuperAdmin(p) => {
                user_updates_handler.mark_participant_updated(&mut result, p.user_id, false);
            }
            ChatEventInternal::ParticipantRelinquishesSuperAdmin(p) => {
                user_updates_handler.mark_participant_updated(&mut result, p.user_id, false);
            }
            ChatEventInternal::ParticipantDismissedAsSuperAdmin(p) => {
                user_updates_handler.mark_participant_updated(&mut result, p.user_id, false);
            }
            ChatEventInternal::RoleChanged(rc) => {
                for user_id in rc.user_ids.iter() {
                    user_updates_handler.mark_participant_updated(&mut result, *user_id, false);
                }
            }
            ChatEventInternal::UsersBlocked(ub) => {
                for user_id in ub.user_ids.iter() {
                    user_updates_handler.mark_user_blocked_updated(&mut result, *user_id, true);
                    user_updates_handler.mark_participant_updated(&mut result, *user_id, true);
                }
            }
            ChatEventInternal::UsersUnblocked(ub) => {
                for user_id in ub.user_ids.iter() {
                    user_updates_handler.mark_user_blocked_updated(&mut result, *user_id, false);
                }
            }
            ChatEventInternal::MessagePinned(p) => {
                if !result.pinned_messages_removed.contains(&p.message_index) {
                    result.pinned_messages_added.push(p.message_index);
                }
            }
            ChatEventInternal::MessageUnpinned(u) => {
                if !result.pinned_messages_added.contains(&u.message_index) {
                    result.pinned_messages_removed.push(u.message_index);
                }
            }
            _ => {}
        }
    }

    if result.participants_added_or_updated.is_empty()
        && result.participants_removed.is_empty()
        && result.blocked_users_added.is_empty()
        && result.blocked_users_removed.is_empty()
        && result.pinned_messages_added.is_empty()
        && result.pinned_messages_removed.is_empty()
    {
        SuccessNoUpdates(latest_event_index)
    } else {
        Success(result)
    }
}

struct UserUpdatesHandler<'a> {
    data: &'a Data,
    users_updated: HashSet<UserId>,
}

impl<'a> UserUpdatesHandler<'a> {
    pub fn mark_participant_updated(&mut self, result: &mut SuccessResult, user_id: UserId, removed: bool) {
        if self.users_updated.insert(user_id) {
            if removed {
                result.participants_removed.push(user_id);
            } else if let Some(participant) = self.data.participants.get_by_user_id(&user_id) {
                result.participants_added_or_updated.push(participant.into());
            }
        }
    }

    pub fn mark_user_blocked_updated(&mut self, result: &mut SuccessResult, user_id: UserId, blocked: bool) {
        if self.users_updated.insert(user_id) {
            if blocked {
                result.participants_removed.push(user_id);
                result.blocked_users_added.push(user_id);
            } else {
                result.blocked_users_removed.push(user_id);
            }
        }
    }
}
