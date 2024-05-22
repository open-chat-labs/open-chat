use ic_cdk::inspect_message;

#[inspect_message]
fn inspect_message() {
    // 'inspect_message' only applies to ingress messages so calls to c2c methods should be rejected
}
