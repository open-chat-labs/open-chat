use canister_client_macros::*;
use user_canister::*;

// Updates
generate_c2c_call!(c2c_charge_user_account);
generate_c2c_call!(c2c_delete_messages);
generate_c2c_call!(c2c_edit_message);
generate_c2c_call!(c2c_grant_super_admin);
generate_c2c_call!(c2c_mark_read_v2);
generate_c2c_call!(c2c_notify_group_deleted);
generate_c2c_call!(c2c_notify_events);
generate_c2c_call!(c2c_remove_from_group);
generate_c2c_call!(c2c_revoke_super_admin);
generate_c2c_call!(c2c_send_messages);
generate_c2c_call!(c2c_set_user_suspended);
generate_c2c_call!(c2c_toggle_reaction);
generate_c2c_call!(c2c_try_add_to_group);
generate_c2c_call!(c2c_undelete_messages);
generate_c2c_call!(c2c_vote_on_proposal);
