use ic_cdk::api::call::CallResult;
use log::error;
use shared::generate_c2c_call;
use shared::types::CanisterId;

use notifications_canister::queries::*;
use notifications_canister::updates::*;

generate_c2c_call!(notifications);

generate_c2c_call!(push_direct_message_notification);
generate_c2c_call!(push_group_message_notification);
generate_c2c_call!(push_subscription);
generate_c2c_call!(push_v1direct_message_notification);
generate_c2c_call!(push_v1group_message_notification);
generate_c2c_call!(remove_notifications);
