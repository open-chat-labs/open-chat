use crate::{Data, RuntimeState};
use chat_events::ChatEventInternal;
use fire_and_forget_handler::FireAndForgetHandler;
use group_index_canister::c2c_mark_community_active;
use msgpack::serialize_then_unwrap;
use std::collections::HashSet;
use types::{CanisterId, Milliseconds, PublicCommunityActivity, TimestampMillis};
use utils::time::{DAY_IN_MS, HOUR_IN_MS};

// If needed, notify the group index canister that there has been activity in this community
pub(crate) fn handle_activity_notification(state: &mut RuntimeState) {
    let now = state.env.now();

    if let Some(mark_active_duration) = state.data.activity_notification_state.notify_if_required(now) {
        let public_community_activity = state.data.is_public.then(|| extract_activity(now, &state.data));

        call_group_index_canister(
            state.data.group_index_canister_id,
            mark_active_duration,
            public_community_activity,
            &mut state.data.fire_and_forget_handler,
        );
    }

    fn extract_activity(now: TimestampMillis, data: &Data) -> PublicCommunityActivity {
        let one_hour_ago = now - HOUR_IN_MS;
        let one_day_ago = now - DAY_IN_MS;

        let mut activity = PublicCommunityActivity {
            timestamp: now,
            member_count: data.members.len(),
            channel_count: data.channels.public_channel_count(),
            ..Default::default()
        };

        let mut message_unique_users = HashSet::new();
        let mut reaction_unique_users = HashSet::new();

        for event in data
            .channels
            .iter()
            .filter(|channel| channel.chat.is_public)
            .flat_map(|channel| {
                channel
                    .chat
                    .events
                    .main_events_list()
                    .values()
                    .take_while(|e| e.timestamp >= one_day_ago)
            })
        {
            let within_last_hour = event.timestamp >= one_hour_ago;

            if let ChatEventInternal::Message(m) = &event.event {
                activity.last_day.messages += 1;
                activity.last_day.reactions += m.reactions.len() as u32;

                if within_last_hour {
                    activity.last_hour.messages += 1;
                    activity.last_hour.reactions += m.reactions.len() as u32
                }

                if message_unique_users.insert(m.sender) {
                    activity.last_day.message_unique_users += 1;
                    if within_last_hour {
                        activity.last_hour.message_unique_users += 1;
                    }
                }

                for user_id in m.reactions.iter().flat_map(|(_, u)| u.iter()).copied() {
                    if reaction_unique_users.insert(user_id) {
                        activity.last_day.reaction_unique_users += 1;
                        if within_last_hour {
                            activity.last_hour.reaction_unique_users += 1;
                        }
                    }
                }
            }
        }

        activity
    }

    fn call_group_index_canister(
        canister_id: CanisterId,
        duration: Milliseconds,
        public_community_activity: Option<PublicCommunityActivity>,
        fire_and_forget_handler: &mut FireAndForgetHandler,
    ) {
        let args = c2c_mark_community_active::Args {
            duration,
            public_community_activity,
        };

        fire_and_forget_handler.send(
            canister_id,
            "c2c_mark_community_active_msgpack".to_string(),
            serialize_then_unwrap(args),
        );
    }
}
