#![cfg(test)]

// Checks the bots SDK decodes every kind of content OpenChat sends bots, and that OpenChat decodes
// everything the SDK sends. The tests which run by default fail on what breaks bots, content which
// doesn't decode. The ignored ones report what the SDK lacks, and CI runs them in a job of their own.

use crate::variants::Variants;
use rmpv::Value;
use std::collections::BTreeSet;

mod samples;
mod sdk_samples;
mod variants;

// Fields the SDK leaves out on purpose
const NOT_IN_SDK: &[&str] = &[
    // Deprecated
    "Prize.winners",
];

#[test]
fn the_sdk_decodes_every_kind_of_content() {
    for content in samples::message_contents() {
        decode_with_sdk(&content);
    }
}

#[test]
fn openchat_decodes_every_kind_of_content_a_bot_sends() {
    for content in sdk_samples::message_contents_initial() {
        let bytes = oc_bots_sdk::msgpack::serialize_then_unwrap(&content);
        let decoded: types::MessageContentInitial = msgpack::deserialize(bytes.as_slice())
            .unwrap_or_else(|error| panic!("OpenChat failed to decode {content:?}: {error}"));
        assert_eq!(decoded.variant(), content.variant());
    }
}

#[test]
#[ignore = "reports what the SDK lacks, which CI runs in a job of its own"]
fn the_sdk_knows_every_kind_of_content() {
    let unsupported: Vec<_> = samples::message_contents()
        .iter()
        .map(|content| format!("{:?}", decode_with_sdk(content)))
        .filter(|decoded| decoded.contains("Unsupported"))
        .collect();

    assert!(
        unsupported.is_empty(),
        "The SDK decodes some or all of these as Unsupported: {unsupported:#?}"
    );
}

#[test]
#[ignore = "reports what the SDK lacks, which CI runs in a job of its own"]
fn the_sdk_has_every_field() {
    let mut missing = BTreeSet::new();
    let mut extra = BTreeSet::new();

    for content in samples::message_contents() {
        let sent = read(&msgpack::serialize_then_unwrap(&content));
        assert!(
            !contains_nil(&sent),
            "Fill in every Option in the {} samples, so that each field is compared",
            content.variant()
        );
        let sent = key_paths(&sent);
        let decoded = key_paths(&read(&oc_bots_sdk::msgpack::serialize_then_unwrap(decode_with_sdk(&content))));

        missing.extend(
            sent.difference(&decoded)
                .filter(|p| !NOT_IN_SDK.contains(&p.as_str()))
                .cloned(),
        );
        extra.extend(decoded.difference(&sent).cloned());
    }

    assert!(missing.is_empty(), "The SDK lacks these fields: {missing:#?}");
    assert!(extra.is_empty(), "The SDK has fields OpenChat doesn't send: {extra:#?}");
}

#[test]
#[ignore = "reports what the SDK lacks, which CI runs in a job of its own"]
fn openchat_reads_every_field_a_bot_sends() {
    let mut ignored = BTreeSet::new();

    for content in sdk_samples::message_contents_initial() {
        let bytes = oc_bots_sdk::msgpack::serialize_then_unwrap(&content);
        let decoded: types::MessageContentInitial = msgpack::deserialize_then_unwrap(&bytes);

        let sent = key_paths(&read(&bytes));
        let decoded = key_paths(&read(&msgpack::serialize_then_unwrap(&decoded)));
        ignored.extend(sent.difference(&decoded).cloned());
    }

    assert!(ignored.is_empty(), "OpenChat ignores these fields bots send: {ignored:#?}");
}

fn decode_with_sdk(content: &types::MessageContent) -> oc_bots_sdk::types::MessageContent {
    let bytes = msgpack::serialize_then_unwrap(content);
    oc_bots_sdk::msgpack::deserialize_from_slice(&bytes)
        .unwrap_or_else(|error| panic!("The SDK failed to decode {content:?}: {error}"))
}

fn read(bytes: &[u8]) -> Value {
    rmpv::decode::read_value(&mut &bytes[..]).unwrap()
}

// The path of every map key, eg. "Crypto.transfer.Pending.ICRC1.amount", leaving out those whose
// value is nil since the SDK omits some `None`s. Items share their array's path, and keys other than
// strings, such as a poll's option indexes, are "*".
fn key_paths(value: &Value) -> BTreeSet<String> {
    fn visit(value: &Value, path: &str, paths: &mut BTreeSet<String>) {
        match value {
            Value::Map(entries) => {
                for (key, value) in entries.iter().filter(|(_, v)| !v.is_nil()) {
                    let key = key.as_str().unwrap_or("*");
                    let path = if path.is_empty() { key.to_string() } else { format!("{path}.{key}") };
                    visit(value, &path, paths);
                    paths.insert(path);
                }
            }
            Value::Array(items) => items.iter().for_each(|item| visit(item, path, paths)),
            _ => {}
        }
    }

    let mut paths = BTreeSet::new();
    visit(value, "", &mut paths);
    paths
}

fn contains_nil(value: &Value) -> bool {
    match value {
        Value::Nil => true,
        Value::Array(items) => items.iter().any(contains_nil),
        Value::Map(entries) => entries.iter().any(|(_, v)| contains_nil(v)),
        _ => false,
    }
}
