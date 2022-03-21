use candid_gen::generate_candid_method;

fn main() {
    generate_candid_method!(user, bio, query);
    generate_candid_method!(user, events, query);
    generate_candid_method!(user, events_by_index, query);
    generate_candid_method!(user, events_range, query);
    generate_candid_method!(user, events_window, query);
    generate_candid_method!(user, initial_state, query);
    generate_candid_method!(user, messages_by_message_index, query);
    generate_candid_method!(user, recommended_groups, query);
    generate_candid_method!(user, search_all_messages, query);
    generate_candid_method!(user, search_messages, query);
    generate_candid_method!(user, transactions, query);
    generate_candid_method!(user, updates, query);

    generate_candid_method!(user, add_recommended_group_exclusions, update);
    generate_candid_method!(user, assume_group_super_admin, update);
    generate_candid_method!(user, block_user, update);
    generate_candid_method!(user, create_group, update);
    generate_candid_method!(user, delete_messages, update);
    generate_candid_method!(user, dismiss_alerts, update);
    generate_candid_method!(user, edit_message, update);
    generate_candid_method!(user, join_group_v2, update);
    generate_candid_method!(user, leave_group, update);
    generate_candid_method!(user, mark_read, update);
    generate_candid_method!(user, mute_notifications, update);
    generate_candid_method!(user, register_poll_vote, update);
    generate_candid_method!(user, relinquish_group_super_admin, update);
    generate_candid_method!(user, send_message, update);
    generate_candid_method!(user, set_avatar, update);
    generate_candid_method!(user, set_bio, update);
    generate_candid_method!(user, set_preferences, update);
    generate_candid_method!(user, toggle_reaction, update);
    generate_candid_method!(user, transfer_cryptocurrency_within_group, update);
    generate_candid_method!(user, unblock_user, update);
    generate_candid_method!(user, unmute_notifications, update);
    generate_candid_method!(user, withdraw_cryptocurrency, update);

    candid::export_service!();
    std::print!("{}", __export_service());
}
