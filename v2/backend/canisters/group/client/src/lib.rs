use canister_client_macros::*;
use group_canister::*;

// Queries
generate_query_call!(events);
generate_query_call!(events_by_index);
generate_query_call!(events_range);
generate_query_call!(summary);
generate_query_call!(summary_updates);

// Updates
generate_update_call!(add_participants);
generate_update_call!(delete_messages);
generate_update_call!(edit_message);
generate_update_call!(send_message);
generate_update_call!(toggle_reaction);
