use crate::{RuntimeState, read_state};
use ic_cdk::inspect_message;

#[inspect_message]
fn inspect_message() {
    read_state(accept_if_valid);
}

fn accept_if_valid(state: &RuntimeState) {
    let method_name = ic_cdk::api::msg_method_name().trim_end_matches("_msgpack").to_string();

    // Everything else, `c2c_pull_puzzles` and `c2c_report_results` included, is either a c2c call
    // or nothing at all. Those two verify their caller asynchronously, so accepting them as
    // ingress lets an anonymous caller drive the registry refresh behind that check.
    let is_valid = match method_name.as_str() {
        "push_now" | "regenerate_today" | "set_config" | "set_game_config" | "set_schedule" | "veto_candidate" => {
            state.is_caller_governance_principal()
        }
        "wallet_receive" => true,
        _ => false,
    };

    if is_valid {
        ic_cdk::api::accept_message();
    }
}
