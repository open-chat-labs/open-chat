use candid_gen::generate_candid_method;

fn main() {
    generate_candid_method!(group, deleted_message, query);
    generate_candid_method!(group, events, query);
    generate_candid_method!(group, events_by_index, query);
    generate_candid_method!(group, events_window, query);
    generate_candid_method!(group, local_user_index, query);
    generate_candid_method!(group, messages_by_message_index, query);
    generate_candid_method!(group, thread_previews, query);
    generate_candid_method!(group, public_summary, query);
    generate_candid_method!(group, rules, query);
    generate_candid_method!(group, search_messages, query);
    generate_candid_method!(group, selected_initial, query);
    generate_candid_method!(group, selected_updates, query);
    generate_candid_method!(group, summary, query);
    generate_candid_method!(group, summary_updates, query);

    generate_candid_method!(group, add_participants, update);
    generate_candid_method!(group, add_reaction, update);
    generate_candid_method!(group, block_user, update);
    generate_candid_method!(group, change_role, update);
    generate_candid_method!(group, claim_prize, update);
    generate_candid_method!(group, decline_invitation, update);
    generate_candid_method!(group, delete_messages, update);
    generate_candid_method!(group, edit_message, update);
    generate_candid_method!(group, make_private, update);
    generate_candid_method!(group, pin_message_v2, update);
    generate_candid_method!(group, register_poll_vote, update);
    generate_candid_method!(group, register_proposal_vote, update);
    generate_candid_method!(group, register_proposal_vote_v2, update);
    generate_candid_method!(group, remove_participant, update);
    generate_candid_method!(group, remove_reaction, update);
    generate_candid_method!(group, send_message_v2, update);
    generate_candid_method!(group, send_message, update);
    generate_candid_method!(group, unblock_user, update);
    generate_candid_method!(group, undelete_messages, update);
    generate_candid_method!(group, unpin_message, update);
    generate_candid_method!(group, update_group_v2, update);

    candid::export_service!();
    std::print!("{}", __export_service());
}
