use crate::UserEvent;
use crate::updates::c2c_notify_low_balance::top_up_child_canister;
use timer_job_queues::{TimerJobItem, grouped_timer_job_batch};
use types::{CanisterId, Milliseconds, QueuedUserEvent};
use utils::canister::{delay_if_should_retry_failed_c2c_call, is_out_of_cycles_error};

// Batched per canister, so that the events for every user a MultiUser canister holds are sent to it
// together
grouped_timer_job_batch!(UserEventBatch, CanisterId, QueuedUserEvent<UserEvent>, 1000);

impl TimerJobItem for UserEventBatch {
    async fn process(&self) -> Result<(), Option<Milliseconds>> {
        let canister_id = self.key;
        let events: Vec<_> = self.items.iter().cloned().map(|e| e.into_parts(canister_id)).collect();

        // A MultiUser canister's users carry an index, and it takes the events for all of them in a
        // single call. A User canister is sent its user's events via the original endpoint, so that
        // this doesn't depend on every User canister having been upgraded to support the new one.
        let response = if events.first().is_some_and(|(user_id, _)| user_id.index() != 0) {
            user_canister_c2c_client::c2c_local_user_index_v2(
                canister_id,
                &user_canister::c2c_local_user_index_v2::Args { events },
            )
            .await
        } else {
            user_canister_c2c_client::c2c_local_user_index(
                canister_id,
                &user_canister::c2c_local_user_index::Args {
                    user_id: canister_id.into(),
                    events: events.into_iter().map(|(_, event)| event).collect(),
                },
            )
            .await
        };

        match response {
            Ok(types::SuccessOnly::Success) => Ok(()),
            Err(error) => {
                if is_out_of_cycles_error(error.reject_code(), error.message()) {
                    top_up_child_canister(Some(canister_id)).await;
                }
                let delay_if_should_retry = delay_if_should_retry_failed_c2c_call(&error);
                Err(delay_if_should_retry)
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use candid::Principal;
    use std::collections::{BTreeMap, VecDeque};
    use types::{BlobReference, IdempotentEnvelope, ImageContent, MessageContentInitial, ThumbnailData, UserId};
    use user_canister::OpenChatBotMessageV2;

    // The events persisted in a queue before they were paired with their users, keyed by user id,
    // read back keyed by canister. The event holds a u128, which isn't self describing in msgpack.
    #[test]
    fn events_queued_before_pairing_read_back_keyed_by_canister() {
        let canister_id = Principal::from_text("dfdal-2uaaa-aaaaa-qaama-cai").unwrap();
        let user_id: UserId = canister_id.into();
        let event = IdempotentEnvelope {
            created_at: 1,
            idempotency_id: 2,
            value: UserEvent::OpenChatBotMessageV2(Box::new(OpenChatBotMessageV2 {
                thread_root_message_id: None,
                content: MessageContentInitial::Image(ImageContent {
                    width: 1,
                    height: 1,
                    thumbnail_data: ThumbnailData(String::new()),
                    caption: None,
                    mime_type: "image/png".to_string(),
                    blob_reference: Some(BlobReference {
                        canister_id,
                        blob_id: u128::MAX,
                    }),
                }),
                mentioned: Vec::new(),
            })),
        };
        let old: BTreeMap<UserId, VecDeque<IdempotentEnvelope<UserEvent>>> =
            BTreeMap::from([(user_id, VecDeque::from([event]))]);

        let new: BTreeMap<CanisterId, VecDeque<QueuedUserEvent<UserEvent>>> =
            msgpack::deserialize_then_unwrap(&msgpack::serialize_then_unwrap(&old));

        let (queued_user_id, queued) = new[&canister_id][0].clone().into_parts(canister_id);
        assert_eq!(queued_user_id, user_id);
        let UserEvent::OpenChatBotMessageV2(message) = queued.value else {
            panic!();
        };
        let MessageContentInitial::Image(image) = message.content else {
            panic!();
        };
        assert_eq!(image.blob_reference.unwrap().blob_id, u128::MAX);

        // And once paired, round trip
        let paired = QueuedUserEvent::new(
            UserId::new_indexed(canister_id, 1),
            new[&canister_id][0].clone().into_parts(canister_id).1,
        );
        let round_tripped: QueuedUserEvent<UserEvent> =
            msgpack::deserialize_then_unwrap(&msgpack::serialize_then_unwrap(&paired));
        assert_eq!(round_tripped.user_id(canister_id), UserId::new_indexed(canister_id, 1));
    }
}
