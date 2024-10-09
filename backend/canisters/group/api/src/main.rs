use candid_gen::generate_candid_method;
use std::env;
use ts_export::generate_ts_method;

#[allow(deprecated)]
fn main() {
    generate_candid_method!(group, deleted_message, query);
    generate_candid_method!(group, events, query);
    generate_candid_method!(group, events_by_index, query);
    generate_candid_method!(group, events_window, query);
    generate_candid_method!(group, invite_code, query);
    generate_candid_method!(group, local_user_index, query);
    generate_candid_method!(group, messages_by_message_index, query);
    generate_candid_method!(group, thread_previews, query);
    generate_candid_method!(group, public_summary, query);
    generate_candid_method!(group, rules, query);
    generate_candid_method!(group, search_messages, query);
    generate_candid_method!(group, selected_initial, query);
    generate_candid_method!(group, selected_updates_v2, query);
    generate_candid_method!(group, summary, query);
    generate_candid_method!(group, summary_updates, query);
    generate_candid_method!(group, video_call_participants, query);

    generate_candid_method!(group, accept_p2p_swap, update);
    generate_candid_method!(group, add_reaction, update);
    generate_candid_method!(group, block_user, update);
    generate_candid_method!(group, cancel_invites, update);
    generate_candid_method!(group, cancel_p2p_swap, update);
    generate_candid_method!(group, change_role, update);
    generate_candid_method!(group, claim_prize, update);
    generate_candid_method!(group, convert_into_community, update);
    generate_candid_method!(group, decline_invitation, update);
    generate_candid_method!(group, delete_messages, update);
    generate_candid_method!(group, disable_invite_code, update);
    generate_candid_method!(group, edit_message_v2, update);
    generate_candid_method!(group, end_video_call, update);
    generate_candid_method!(group, enable_invite_code, update);
    generate_candid_method!(group, follow_thread, update);
    generate_candid_method!(group, join_video_call, update);
    generate_candid_method!(group, pin_message_v2, update);
    generate_candid_method!(group, register_poll_vote, update);
    generate_candid_method!(group, register_proposal_vote, update);
    // generate_candid_method!(group, register_proposal_vote_v2, update);
    generate_candid_method!(group, remove_participant, update);
    generate_candid_method!(group, remove_reaction, update);
    generate_candid_method!(group, report_message, update);
    generate_candid_method!(group, reset_invite_code, update);
    generate_candid_method!(group, send_message_v2, update);
    generate_candid_method!(group, set_video_call_presence, update);
    generate_candid_method!(group, start_video_call, update);
    generate_candid_method!(group, toggle_mute_notifications, update);
    generate_candid_method!(group, unblock_user, update);
    generate_candid_method!(group, undelete_messages, update);
    generate_candid_method!(group, unfollow_thread, update);
    generate_candid_method!(group, unpin_message, update);
    generate_candid_method!(group, update_group_v2, update);

    let directory = env::current_dir().unwrap().join("tsBindings/group");
    if directory.exists() {
        std::fs::remove_dir_all(&directory).unwrap();
    }

    generate_ts_method!(group, deleted_message);
    generate_ts_method!(group, events);
    generate_ts_method!(group, events_by_index);
    generate_ts_method!(group, events_window);
    generate_ts_method!(group, invite_code);
    generate_ts_method!(group, local_user_index);
    generate_ts_method!(group, messages_by_message_index);
    generate_ts_method!(group, thread_previews);
    generate_ts_method!(group, public_summary);
    generate_ts_method!(group, rules);
    generate_ts_method!(group, search_messages);
    generate_ts_method!(group, selected_initial);
    generate_ts_method!(group, selected_updates_v2);
    generate_ts_method!(group, summary);
    generate_ts_method!(group, summary_updates);
    generate_ts_method!(group, video_call_participants);

    generate_ts_method!(group, accept_p2p_swap);
    generate_ts_method!(group, add_reaction);
    generate_ts_method!(group, block_user);
    generate_ts_method!(group, cancel_invites);
    generate_ts_method!(group, cancel_p2p_swap);
    generate_ts_method!(group, change_role);
    generate_ts_method!(group, claim_prize);
    generate_ts_method!(group, convert_into_community);
    generate_ts_method!(group, decline_invitation);
    generate_ts_method!(group, delete_messages);
    generate_ts_method!(group, disable_invite_code);
    generate_ts_method!(group, edit_message_v2);
    generate_ts_method!(group, enable_invite_code);
    generate_ts_method!(group, follow_thread);
    generate_ts_method!(group, join_video_call);
    generate_ts_method!(group, pin_message_v2);
    generate_ts_method!(group, register_poll_vote);
    generate_ts_method!(group, register_proposal_vote);
    // generate_ts_method!(group, register_proposal_vote_v2);
    generate_ts_method!(group, remove_participant);
    generate_ts_method!(group, remove_reaction);
    generate_ts_method!(group, report_message);
    generate_ts_method!(group, reset_invite_code);
    generate_ts_method!(group, send_message_v2);
    generate_ts_method!(group, set_video_call_presence);
    generate_ts_method!(group, toggle_mute_notifications);
    generate_ts_method!(group, unblock_user);
    generate_ts_method!(group, undelete_messages);
    generate_ts_method!(group, unfollow_thread);
    generate_ts_method!(group, unpin_message);
    generate_ts_method!(group, update_group_v2);

    candid::export_service!();
    std::print!("{}", __export_service());
}
