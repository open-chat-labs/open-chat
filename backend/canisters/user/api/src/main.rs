use std::env;
use ts_export::generate_ts_method;

#[allow(deprecated)]
fn main() {
    let directory = env::current_dir().unwrap().join("tsBindings/user");
    if directory.exists() {
        std::fs::remove_dir_all(&directory).unwrap();
    }

    generate_ts_method!(user, bio);
    generate_ts_method!(user, cached_btc_address);
    generate_ts_method!(user, chit_events);
    generate_ts_method!(user, contacts);
    generate_ts_method!(user, deleted_message);
    generate_ts_method!(user, events);
    generate_ts_method!(user, events_by_index);
    generate_ts_method!(user, events_window);
    generate_ts_method!(user, hot_group_exclusions);
    generate_ts_method!(user, initial_state);
    generate_ts_method!(user, local_user_index);
    generate_ts_method!(user, message_activity_feed);
    generate_ts_method!(user, messages_by_message_index);
    generate_ts_method!(user, public_profile);
    generate_ts_method!(user, search_messages);
    generate_ts_method!(user, saved_crypto_accounts);
    generate_ts_method!(user, token_swap_status);
    generate_ts_method!(user, token_swaps);
    generate_ts_method!(user, updates);

    generate_ts_method!(user, accept_p2p_swap);
    generate_ts_method!(user, add_hot_group_exclusions);
    generate_ts_method!(user, add_reaction);
    generate_ts_method!(user, approve_transfer);
    generate_ts_method!(user, archive_unarchive_chats);
    generate_ts_method!(user, block_user);
    generate_ts_method!(user, btc_address);
    generate_ts_method!(user, cancel_message_reminder);
    generate_ts_method!(user, cancel_p2p_swap);
    generate_ts_method!(user, claim_daily_chit);
    generate_ts_method!(user, configure_wallet);
    generate_ts_method!(user, create_community);
    generate_ts_method!(user, create_group);
    generate_ts_method!(user, delete_community);
    generate_ts_method!(user, delete_direct_chat);
    generate_ts_method!(user, delete_group);
    generate_ts_method!(user, delete_messages);
    generate_ts_method!(user, edit_message_v2);
    generate_ts_method!(user, join_video_call);
    generate_ts_method!(user, leave_community);
    generate_ts_method!(user, leave_group);
    generate_ts_method!(user, manage_favourite_chats);
    generate_ts_method!(user, mark_achievements_seen);
    generate_ts_method!(user, mark_message_activity_feed_read);
    generate_ts_method!(user, mark_read);
    generate_ts_method!(user, mute_notifications);
    generate_ts_method!(user, pin_chat_v2);
    generate_ts_method!(user, remove_reaction);
    generate_ts_method!(user, reclaim_swap_tokens);
    generate_ts_method!(user, report_message);
    generate_ts_method!(user, retrieve_btc);
    generate_ts_method!(user, save_crypto_account);
    generate_ts_method!(user, send_message_with_transfer_to_channel);
    generate_ts_method!(user, send_message_with_transfer_to_group);
    generate_ts_method!(user, send_message_v2);
    generate_ts_method!(user, set_avatar);
    generate_ts_method!(user, set_bio);
    generate_ts_method!(user, set_community_indexes);
    generate_ts_method!(user, set_contact);
    generate_ts_method!(user, set_message_reminder_v2);
    generate_ts_method!(user, set_pin_number);
    generate_ts_method!(user, swap_tokens);
    generate_ts_method!(user, tip_message);
    generate_ts_method!(user, unblock_user);
    generate_ts_method!(user, undelete_messages);
    generate_ts_method!(user, unmute_notifications);
    generate_ts_method!(user, unpin_chat_v2);
    generate_ts_method!(user, withdraw_crypto_v2);
    generate_ts_method!(user, update_bot);

    candid::export_service!();
    std::print!("{}", __export_service());
}
