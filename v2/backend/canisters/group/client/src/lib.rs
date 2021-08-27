use group_canister::*;
use ic_cdk::api::call::CallResult;
use log::error;
use types::CanisterId;
use utils::generate_c2c_call;

// Queries
generate_c2c_call!(events);
generate_c2c_call!(events_by_index);
generate_c2c_call!(summary);
generate_c2c_call!(summary_updates);

// Updates
generate_c2c_call!(add_participants);
generate_c2c_call!(block_user);
generate_c2c_call!(c2c_join_group);
generate_c2c_call!(make_admin);
generate_c2c_call!(mark_read);
generate_c2c_call!(remove_admin);
generate_c2c_call!(remove_participant);
generate_c2c_call!(send_message);
