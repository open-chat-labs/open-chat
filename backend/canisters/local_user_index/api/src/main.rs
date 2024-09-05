use candid_gen::generate_candid_method;
use std::env;
use ts_export::generate_ts_method;

fn main() {
    generate_candid_method!(local_user_index, access_token, query);
    generate_candid_method!(local_user_index, chat_events, query);
    generate_candid_method!(local_user_index, group_and_community_summary_updates, query);

    generate_candid_method!(local_user_index, invite_users_to_channel, update);
    generate_candid_method!(local_user_index, invite_users_to_community, update);
    generate_candid_method!(local_user_index, invite_users_to_group, update);
    generate_candid_method!(local_user_index, join_channel, update);
    generate_candid_method!(local_user_index, join_community, update);
    generate_candid_method!(local_user_index, join_group, update);
    generate_candid_method!(local_user_index, register_user, update);
    generate_candid_method!(local_user_index, report_message_v2, update);

    let directory = env::current_dir().unwrap().join("tsBindings/localUserIndex");
    if directory.exists() {
        std::fs::remove_dir_all(&directory).unwrap();
    }

    generate_ts_method!(local_user_index, access_token);
    generate_ts_method!(local_user_index, chat_events);
    generate_ts_method!(local_user_index, group_and_community_summary_updates);

    generate_ts_method!(local_user_index, invite_users_to_channel);
    generate_ts_method!(local_user_index, invite_users_to_community);
    generate_ts_method!(local_user_index, invite_users_to_group);
    generate_ts_method!(local_user_index, join_channel);
    generate_ts_method!(local_user_index, join_community);
    generate_ts_method!(local_user_index, join_group);
    generate_ts_method!(local_user_index, register_user);
    generate_ts_method!(local_user_index, report_message_v2);

    candid::export_service!();
    std::print!("{}", __export_service());
}
