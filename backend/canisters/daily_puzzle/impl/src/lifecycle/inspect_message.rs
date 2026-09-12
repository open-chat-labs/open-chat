use candid::Principal;
use ic_cdk::inspect_message;

#[inspect_message]
fn inspect_message() {
    // Everything else, `c2c_pull_puzzles` and `c2c_report_results` included, is either a c2c call
    // or nothing at all. Those two verify their caller asynchronously, so accepting them as
    // ingress lets an anonymous caller drive the registry refresh behind that check.
    //
    // The platform operator functions check their caller asynchronously too, against the user
    // index, so the most that can be established here is that the caller is somebody.
    let method_name = ic_cdk::api::msg_method_name().trim_end_matches("_msgpack").to_string();

    let is_valid = match method_name.as_str() {
        "candidates" | "push_now" | "regenerate_today" | "set_config" | "set_game_config" | "set_schedule"
        | "veto_candidate" => ic_cdk::api::msg_caller() != Principal::anonymous(),
        "wallet_receive" => true,
        _ => false,
    };

    if is_valid {
        ic_cdk::api::accept_message();
    }
}
