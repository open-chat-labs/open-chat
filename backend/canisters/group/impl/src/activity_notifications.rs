use crate::{mutate_state, Data, RuntimeState};
use chat_events::{ChatEventInternal, Reader};
use group_index_canister::c2c_mark_active;
use std::collections::HashSet;
use types::{CanisterId, PublicGroupActivity, TimestampMillis};
use utils::time::{DAY_IN_MS, HOUR_IN_MS};

// If needed, notify the group index canister that there has been activity in this group
pub(crate) fn handle_activity_notification(runtime_state: &mut RuntimeState) {
    let now = runtime_state.env.now();
    let mark_active_duration = runtime_state.data.mark_active_duration;

    let requires_notification = runtime_state
        .data
        .activity_notification_state
        .start_if_required(now, mark_active_duration);

    if requires_notification {
        let public_group_activity =
            if runtime_state.data.is_public { Some(extract_activity(now, &runtime_state.data)) } else { None };

        let args = c2c_mark_active::Args {
            duration: mark_active_duration,
            public_group_activity,
        };

        ic_cdk::spawn(call_group_index_canister(runtime_state.data.group_index_canister_id, args));
    }

    fn extract_activity(now: TimestampMillis, data: &Data) -> PublicGroupActivity {
        let one_hour_ago = now - HOUR_IN_MS;
        let one_day_ago = now - DAY_IN_MS;

        let mut activity = PublicGroupActivity {
            timestamp: now,
            participant_count: data.participants.len(),
            ..Default::default()
        };

        let mut message_unique_users = HashSet::new();
        let mut reaction_unique_users = HashSet::new();

        let mut inc_participant_count = |count, within_last_hour| {
            activity.last_day.participant_count_change += count;
            if within_last_hour {
                activity.last_hour.participant_count_change += count;
            }
        };

        for event in data
            .events
            .main_events_reader(now)
            .iter(None, false)
            .take_while(|e| e.timestamp >= one_day_ago)
        {
            let within_last_hour = event.timestamp >= one_hour_ago;

            match &event.event {
                ChatEventInternal::GroupChatCreated(_) => {
                    inc_participant_count(1, within_last_hour);
                }
                ChatEventInternal::Message(m) => {
                    activity.last_day.messages += 1;
                    if within_last_hour {
                        activity.last_hour.messages += 1;
                    }
                    if message_unique_users.insert(m.sender) {
                        activity.last_day.message_unique_users += 1;
                        if within_last_hour {
                            activity.last_hour.message_unique_users += 1;
                        }
                    }
                }
                ChatEventInternal::MessageReactionAdded(r) => {
                    activity.last_day.reactions += 1;
                    if within_last_hour {
                        activity.last_hour.reactions += 1;
                    }
                    if reaction_unique_users.insert(r.updated_by) {
                        activity.last_day.reaction_unique_users += 1;
                        if within_last_hour {
                            activity.last_hour.reaction_unique_users += 1;
                        }
                    }
                }
                ChatEventInternal::ParticipantsAdded(p) => {
                    let count = p.user_ids.len() as i32;
                    inc_participant_count(count, within_last_hour);
                }
                ChatEventInternal::ParticipantsRemoved(p) => {
                    let count = p.user_ids.len() as i32;
                    inc_participant_count(-count, within_last_hour);
                }
                ChatEventInternal::ParticipantJoined(_) => {
                    inc_participant_count(1, within_last_hour);
                }
                ChatEventInternal::ParticipantLeft(_) => {
                    inc_participant_count(-1, within_last_hour);
                }
                _ => {}
            }
        }

        activity
    }

    async fn call_group_index_canister(canister_id: CanisterId, args: c2c_mark_active::Args) {
        let response = group_index_canister_c2c_client::c2c_mark_active(canister_id, &args).await;
        mutate_state(|state| handle_response(response.is_ok(), state));
    }

    fn handle_response(success: bool, runtime_state: &mut RuntimeState) {
        if success {
            let now = runtime_state.env.now();
            runtime_state.data.activity_notification_state.mark_succeeded(now);
        } else {
            runtime_state.data.activity_notification_state.mark_failed();
        }
    }
}
