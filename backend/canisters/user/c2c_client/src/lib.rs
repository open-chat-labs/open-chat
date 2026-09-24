use canister_client::{generate_c2c_call, generate_candid_c2c_call};
use user_canister::*;

// Queries
generate_c2c_call!(c2c_bot_chat_summary);
generate_c2c_call!(c2c_can_issue_access_token_v2);
generate_c2c_call!(c2c_groups_and_communities);

// Updates
generate_c2c_call!(c2c_bot_add_reaction);
generate_c2c_call!(c2c_bot_send_message);
generate_c2c_call!(c2c_accept_p2p_swap);
generate_c2c_call!(c2c_charge_user_account);
generate_c2c_call!(c2c_community_canister, 300);
generate_c2c_call!(c2c_community_canister_v2, 300);
generate_c2c_call!(c2c_game_chit);
generate_c2c_call!(c2c_grant_super_admin);
generate_c2c_call!(c2c_group_canister, 300);
generate_c2c_call!(c2c_group_canister_v2, 300);
generate_candid_c2c_call!(c2c_handle_bot_messages);
generate_c2c_call!(c2c_install_bot);
generate_c2c_call!(c2c_notify_community_deleted);
generate_c2c_call!(c2c_local_user_index, 300);
generate_c2c_call!(c2c_local_user_index_v2, 300);
generate_c2c_call!(c2c_notify_group_deleted);
generate_c2c_call!(c2c_pay_for_premium_item);
generate_c2c_call!(c2c_remove_from_community);
generate_c2c_call!(c2c_remove_from_group);
generate_c2c_call!(c2c_revoke_super_admin);
generate_c2c_call!(c2c_set_user_suspended);
generate_c2c_call!(c2c_try_start_migration);
generate_c2c_call!(c2c_export_user);
generate_c2c_call!(c2c_export_user_stable_memory);
generate_c2c_call!(c2c_uninstall_bot);
generate_c2c_call!(c2c_user_canister, 300);
generate_c2c_call!(c2c_user_canister_v2, 300);
generate_c2c_call!(c2c_vote_on_proposal);
generate_c2c_call!(c2c_withdraw_from_icpswap);
generate_c2c_call!(events);
generate_c2c_call!(events_by_index);
generate_c2c_call!(events_window);

// Sends the previous shape of the `c2c_can_issue_access_token_v2` args (the bare `AccessTypeArgs`),
// which User canisters on the previous wasm require. Remove once they have all been upgraded.
pub async fn c2c_can_issue_access_token_v2_legacy(
    canister_id: types::CanisterId,
    args: &types::c2c_can_issue_access_token::AccessTypeArgs,
) -> Result<c2c_can_issue_access_token_v2::Response, types::C2CError> {
    canister_client::make_c2c_call(
        canister_id,
        "c2c_can_issue_access_token_v2_msgpack",
        args,
        msgpack::serialize_to_vec,
        |r| msgpack::deserialize(r),
        None,
    )
    .await
}
