use candid_gen::generate_candid_method;
use std::env;
use ts_export::generate_ts_method;

fn main() {
    // generate_candid_method!(local_user_index, bot_chat_details, query);
    // generate_candid_method!(local_user_index, bot_chat_events, query);

    generate_candid_method!(local_user_index, bot_create_channel, update);
    generate_candid_method!(local_user_index, bot_delete_channel, update);
    generate_candid_method!(local_user_index, bot_send_message, update);

    candid::export_service!();
    std::print!("{}", __export_service());

    let directory = env::current_dir().unwrap().join("tsBindings/localUserIndex");
    if directory.exists() {
        std::fs::remove_dir_all(&directory).unwrap();
    }

    generate_ts_method!(local_user_index, access_token_v2);
    generate_ts_method!(local_user_index, chat_events);
    generate_ts_method!(local_user_index, group_and_community_summary_updates);

    generate_ts_method!(local_user_index, bot_create_channel);
    generate_ts_method!(local_user_index, bot_delete_channel);
    generate_ts_method!(local_user_index, bot_chat_details);
    generate_ts_method!(local_user_index, bot_chat_events);
    generate_ts_method!(local_user_index, bot_send_message);
    generate_ts_method!(local_user_index, install_bot);
    generate_ts_method!(local_user_index, invite_users_to_channel);
    generate_ts_method!(local_user_index, invite_users_to_community);
    generate_ts_method!(local_user_index, invite_users_to_group);
    generate_ts_method!(local_user_index, join_channel);
    generate_ts_method!(local_user_index, join_community);
    generate_ts_method!(local_user_index, join_group);
    generate_ts_method!(local_user_index, register_user);
    generate_ts_method!(local_user_index, report_message_v2);
    generate_ts_method!(local_user_index, uninstall_bot);
    generate_ts_method!(local_user_index, withdraw_from_icpswap);
}
