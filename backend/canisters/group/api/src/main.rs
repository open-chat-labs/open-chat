use std::env;
use ts_export::generate_ts_method;

fn main() {
    let directory = env::current_dir().unwrap().join("tsBindings/group");
    if directory.exists() {
        std::fs::remove_dir_all(&directory).unwrap();
    }

    generate_ts_method!(group, active_proposal_tallies);
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
    generate_ts_method!(group, webhook);

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
    generate_ts_method!(group, delete_webhook);
    generate_ts_method!(group, disable_invite_code);
    generate_ts_method!(group, edit_message_v2);
    generate_ts_method!(group, enable_invite_code);
    generate_ts_method!(group, follow_thread);
    generate_ts_method!(group, join_video_call);
    generate_ts_method!(group, pin_message_v2);
    generate_ts_method!(group, regenerate_webhook);
    generate_ts_method!(group, register_poll_vote);
    generate_ts_method!(group, register_proposal_vote);
    generate_ts_method!(group, register_proposal_vote_v2);
    generate_ts_method!(group, register_webhook);
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
    generate_ts_method!(group, update_bot);
    generate_ts_method!(group, update_group_v2);
    generate_ts_method!(group, update_webhook);
}
