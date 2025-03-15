use canister_client::{generate_c2c_call, generate_candid_c2c_call};
use user_canister::*;

// Queries
generate_c2c_call!(c2c_bot_api_key);
generate_c2c_call!(c2c_can_issue_access_token_v2);
generate_c2c_call!(c2c_is_empty_and_dormant);

// Updates
generate_c2c_call!(c2c_bot_send_message);
generate_c2c_call!(c2c_accept_p2p_swap);
generate_c2c_call!(c2c_charge_user_account);
generate_c2c_call!(c2c_community_canister, 60);
generate_c2c_call!(c2c_grant_super_admin);
generate_c2c_call!(c2c_group_canister, 60);
generate_candid_c2c_call!(c2c_handle_bot_messages);
generate_c2c_call!(c2c_install_bot);
generate_c2c_call!(c2c_notify_community_deleted);
generate_c2c_call!(c2c_local_user_index, 60);
generate_c2c_call!(c2c_notify_group_deleted);
generate_c2c_call!(c2c_remove_from_community);
generate_c2c_call!(c2c_remove_from_group);
generate_c2c_call!(c2c_revoke_super_admin);
generate_c2c_call!(c2c_set_user_suspended);
generate_c2c_call!(c2c_uninstall_bot);
generate_c2c_call!(c2c_user_canister, 60);
generate_c2c_call!(c2c_vote_on_proposal);
generate_c2c_call!(c2c_withdraw_from_icpswap);
generate_c2c_call!(events);
generate_c2c_call!(events_by_index);
generate_c2c_call!(events_window);
