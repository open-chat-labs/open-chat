use crate::{generate_msgpack_query_call, generate_msgpack_update_call};
use multi_user_canister::c2c_create_user;
use user_canister::{bio, events, events_by_index, events_window, send_message_v2};

// Queries
generate_msgpack_query_call!(bio);
generate_msgpack_query_call!(events);
generate_msgpack_query_call!(events_by_index);
generate_msgpack_query_call!(events_window);

// Updates
generate_msgpack_update_call!(c2c_create_user);
generate_msgpack_update_call!(send_message_v2);
