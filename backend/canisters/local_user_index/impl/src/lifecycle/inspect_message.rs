use ic_cdk_macros::inspect_message;

#[inspect_message]
fn inspect_message() {
    // TODO temp hack!
    let method_name = ic_cdk::api::call::method_name();
    if method_name == "start_jobs" {
        ic_cdk::api::call::accept_message();
    }

    // 'inspect_message' only applies to ingress messages so calls to c2c methods should be rejected
}
