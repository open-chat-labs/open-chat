use crate::RuntimeState;
use candid::Encode;
use serde_bytes::ByteBuf;
use types::{CanisterId, EventWrapper, Message, MessageContent, UserId};

pub mod add_recommended_group_exclusions;
pub mod assume_group_super_admin;
pub mod block_user;
pub mod c2c_charge_user_account;
pub mod c2c_delete_messages;
pub mod c2c_edit_message;
pub mod c2c_end_poll;
pub mod c2c_grant_super_admin;
pub mod c2c_mark_read;
pub mod c2c_remove_from_group;
pub mod c2c_retry_sending_failed_messages;
pub mod c2c_revoke_super_admin;
pub mod c2c_send_message;
pub mod c2c_toggle_reaction;
pub mod c2c_try_add_to_group;
pub mod create_group;
pub mod delete_messages;
pub mod edit_message;
pub mod join_group;
pub mod leave_group;
pub mod mark_alerts_read;
pub mod mark_read;
pub mod mute_notifications;
pub mod register_poll_vote;
pub mod relinquish_group_super_admin;
pub mod send_message;
pub mod set_avatar;
pub mod set_bio;
pub mod set_preferences;
pub mod toggle_reaction;
pub mod transfer_cryptocurrency_within_group;
pub mod unblock_user;
pub mod wallet_receive;
pub mod withdraw_cryptocurrency;

mod send_message_common {
    use super::*;
    use types::{MessageIndex, TimestampMillis};

    pub(crate) fn register_callbacks_if_required(
        other_user: UserId,
        message_event: &EventWrapper<Message>,
        runtime_state: &mut RuntimeState,
    ) {
        async fn register_end_poll_callback(
            callback_canister_id: CanisterId,
            other_user: UserId,
            message_index: MessageIndex,
            end_date: TimestampMillis,
        ) {
            let payload = ByteBuf::from(
                Encode!(&user_canister::c2c_end_poll::Args {
                    user_id: other_user,
                    message_index,
                })
                .unwrap(),
            );
            let args = callback_canister::c2c_register_callback::Args {
                method_name: "c2c_end_poll".to_string(),
                payload,
                timestamp: end_date,
            };
            let _ = callback_canister_c2c_client::c2c_register_callback(callback_canister_id, &args).await;
        }

        if let MessageContent::Poll(p) = &message_event.event.content {
            if let Some(end_date) = p.config.end_date {
                ic_cdk::spawn(register_end_poll_callback(
                    runtime_state.data.callback_canister_id,
                    other_user,
                    message_event.event.message_index,
                    end_date,
                ));
            }
        }
    }
}
