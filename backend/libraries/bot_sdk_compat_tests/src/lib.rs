#![cfg(test)]

// Checks the bots SDK decodes every kind of content OpenChat sends bots, and that OpenChat decodes
// everything the SDK sends. The tests which run by default fail on what breaks bots: content which
// doesn't decode, or a field one side has which the other has renamed or removed. The ignored ones
// report what the SDK lacks, and CI runs them in a job of their own.

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

// Kinds the SDK can send which OpenChat rejects, as its bot endpoints take `BotMessageContent`.
// Either the SDK should drop them or OpenChat accept them.
const REJECTED_FROM_BOTS: &[&str] = &["Custom"];

#[test]
fn the_samples_fill_every_field() {
    for content in samples::message_contents() {
        assert!(
            is_filled(&read(&msgpack::serialize_then_unwrap(&content))),
            "Fill in every Option and list in the {} samples, so that each field is compared",
            content.variant()
        );
    }
    for content in sdk_samples::message_contents_initial(true) {
        assert!(
            !format!("{content:?}").contains("None"),
            "Fill in every Option in the SDK's {} samples, so that each field is compared",
            content.variant()
        );
    }
}

#[test]
fn the_sdk_decodes_every_kind_of_content() {
    for content in samples::message_contents() {
        decode_with_sdk(&content);
    }
}

// OpenChat sends a `None` as nil, so wherever it decodes a nil the SDK must too. Some of its
// decoders for legacy fields panic on a nil it never sends, rather than erroring.
#[test]
fn the_sdk_decodes_content_with_any_optional_field_unset() {
    for content in samples::message_contents() {
        for unset in each_map_value_nil(&read(&msgpack::serialize_then_unwrap(&content))) {
            let bytes = write(&unset);
            let openchat_decodes =
                std::panic::catch_unwind(|| msgpack::deserialize::<types::MessageContent, _>(bytes.as_slice()).is_ok())
                    .unwrap_or(false);

            if openchat_decodes {
                oc_bots_sdk::msgpack::deserialize_from_slice::<oc_bots_sdk::types::MessageContent>(&bytes)
                    .unwrap_or_else(|error| panic!("The SDK failed to decode {unset}: {error}"));
            }
        }
    }
}

// A field the SDK has which OpenChat no longer sends decodes as its default, so bots silently lose
// it. The samples fill every Option, so a `None` in what the SDK decodes means the same.
#[test]
fn openchat_sends_every_field_the_sdk_has() {
    let mut not_sent = BTreeSet::new();
    let mut decoded_as_none = Vec::new();

    for content in samples::message_contents() {
        let decoded = decode_with_sdk(&content);
        let debug = format!("{decoded:?}");
        if debug.contains("None") {
            decoded_as_none.push(debug);
        }

        let sent = key_paths(&read(&msgpack::serialize_then_unwrap(&content)));
        let decoded = key_paths(&read(&oc_bots_sdk::msgpack::serialize_then_unwrap(decoded)));
        // A kind the SDK doesn't know yet isn't a field it has
        not_sent.extend(
            decoded
                .difference(&sent)
                .filter(|p| !p.split('.').any(|key| key == "Unsupported"))
                .cloned(),
        );
    }

    assert!(
        not_sent.is_empty() && decoded_as_none.is_empty(),
        "OpenChat doesn't send these fields the SDK has: {not_sent:#?}\nThese decode with a None where OpenChat sent a value: {decoded_as_none:#?}"
    );
}

// Both with every Option filled in, and with none, as the SDK leaves `None`s out
#[test]
fn openchat_decodes_every_kind_of_content_a_bot_sends() {
    for content in sdk_samples::message_contents_initial(true)
        .into_iter()
        .chain(sdk_samples::message_contents_initial(false))
    {
        let bytes = oc_bots_sdk::msgpack::serialize_then_unwrap(&content);
        let decoded = msgpack::deserialize::<types::BotMessageContent, _>(bytes.as_slice());

        if REJECTED_FROM_BOTS.contains(&content.variant()) {
            assert!(
                decoded.is_err(),
                "OpenChat now accepts {}, so remove it from REJECTED_FROM_BOTS",
                content.variant()
            );
        } else {
            let decoded = decoded.unwrap_or_else(|error| panic!("OpenChat failed to decode {content:?}: {error}"));
            assert_eq!(decoded.variant(), content.variant());
        }
    }
}

#[test]
fn openchat_reads_every_field_a_bot_sends() {
    let mut ignored = BTreeSet::new();

    for content in sdk_samples::message_contents_initial(true)
        .into_iter()
        .filter(|c| !REJECTED_FROM_BOTS.contains(&c.variant()))
    {
        let bytes = oc_bots_sdk::msgpack::serialize_then_unwrap(&content);
        let decoded: types::BotMessageContent = msgpack::deserialize_then_unwrap(&bytes);

        let sent = key_paths(&read(&bytes));
        let decoded = key_paths(&read(&msgpack::serialize_then_unwrap(&decoded)));
        ignored.extend(sent.difference(&decoded).cloned());
    }

    assert!(ignored.is_empty(), "OpenChat ignores these fields bots send: {ignored:#?}");
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

    for content in samples::message_contents() {
        let sent = key_paths(&read(&msgpack::serialize_then_unwrap(&content)));
        let decoded = key_paths(&read(&oc_bots_sdk::msgpack::serialize_then_unwrap(decode_with_sdk(&content))));
        missing.extend(
            sent.difference(&decoded)
                .filter(|p| !NOT_IN_SDK.contains(&p.as_str()))
                .cloned(),
        );
    }

    assert!(missing.is_empty(), "The SDK lacks these fields: {missing:#?}");
}

fn decode_with_sdk(content: &types::MessageContent) -> oc_bots_sdk::types::MessageContent {
    let bytes = msgpack::serialize_then_unwrap(content);
    oc_bots_sdk::msgpack::deserialize_from_slice(&bytes)
        .unwrap_or_else(|error| panic!("The SDK failed to decode {content:?}: {error}"))
}

fn read(bytes: &[u8]) -> Value {
    rmpv::decode::read_value(&mut &bytes[..]).unwrap()
}

fn write(value: &Value) -> Vec<u8> {
    let mut bytes = Vec::new();
    rmpv::encode::write_value(&mut bytes, value).unwrap();
    bytes
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

// Copies of `value`, each with one map value, at any depth, set to nil
fn each_map_value_nil(value: &Value) -> Vec<Value> {
    let mut copies = Vec::new();
    match value {
        Value::Map(entries) => {
            for (i, (_, inner)) in entries.iter().enumerate() {
                let mut copy = entries.clone();
                copy[i].1 = Value::Nil;
                copies.push(Value::Map(copy));

                for inner in each_map_value_nil(inner) {
                    let mut copy = entries.clone();
                    copy[i].1 = inner;
                    copies.push(Value::Map(copy));
                }
            }
        }
        Value::Array(items) => {
            for (i, item) in items.iter().enumerate() {
                for item in each_map_value_nil(item) {
                    let mut copy = items.clone();
                    copy[i] = item;
                    copies.push(Value::Array(copy));
                }
            }
        }
        _ => {}
    }
    copies
}

// No nils, and no empty lists or maps, which would hide the fields of what they hold
fn is_filled(value: &Value) -> bool {
    match value {
        Value::Nil => false,
        Value::Array(items) => !items.is_empty() && items.iter().all(is_filled),
        Value::Map(entries) => !entries.is_empty() && entries.iter().all(|(_, v)| is_filled(v)),
        _ => true,
    }
}
