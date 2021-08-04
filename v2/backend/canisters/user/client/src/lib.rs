use ic_cdk::api::call::CallResult;
use log::error;
use shared::generate_c2c_call;
use shared::types::CanisterId;

pub mod queries {
    use super::*;
    use user_canister::queries::*;

    generate_c2c_call!(chats);
    generate_c2c_call!(events);
    generate_c2c_call!(events_by_index);
}

pub mod updates {
    use super::*;
    use user_canister::updates::*;

    generate_c2c_call!(create_group);
    generate_c2c_call!(handle_mark_read);
    generate_c2c_call!(handle_message_received);
    generate_c2c_call!(join_group);
    generate_c2c_call!(mark_read);
    generate_c2c_call!(send_message);
}
