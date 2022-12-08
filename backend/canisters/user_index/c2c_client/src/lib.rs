use canister_client_macros::*;
use user_index_canister::*;

// Queries
generate_c2c_call!(c2c_lookup_principal);
generate_c2c_call!(c2c_lookup_user);
generate_c2c_call!(user);

// Updates
generate_c2c_call!(c2c_mark_send_message_failed);
generate_c2c_call!(c2c_mark_users_online);
generate_c2c_call!(c2c_migrate_user_principal);
generate_c2c_call!(c2c_set_avatar);
generate_c2c_call!(c2c_suspend_users);
generate_c2c_call!(c2c_register_bot);
