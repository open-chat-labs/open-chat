;; A minimal canister which relays calls from its controllers, making them as itself.
;;
;; It exists so that the funds held by the old canister of a user who has been migrated to a
;; MultiUser canister can be recovered: once the User canister has been uninstalled, install
;; this on it, relay calls through it to the ledgers to transfer the funds to the user's new
;; account, then uninstall it again.
;;
;; `relay` takes raw (not candid) args:
;;
;;   callee length (1 byte) | callee | method length (1 byte) | method | payload
;;
;; and calls `method` on `callee` with `payload`, with no cycles attached. Once the callee
;; responds it replies with the callee's reject code (u32 LE), which is 0 if the callee replied,
;; followed by the callee's reply or reject message.
;;
;; The call is a bounded wait (best-effort response) call with a 30 second timeout, so a callee
;; which never responds can't hold on to the cycles reserved for its response for longer than
;; that. If it times out the reject code is SYS_UNKNOWN, and the callee may or may not have acted.
;;
;; Only a controller can call `relay`, which gives them nothing they don't already have, since
;; they could install any code they like on the canister.
;;
;; Build with: wat2wasm call_relay.wat -o call_relay.wasm
(module
  (import "ic0" "msg_caller_size" (func $msg_caller_size (result i32)))
  (import "ic0" "msg_caller_copy" (func $msg_caller_copy (param i32 i32 i32)))
  (import "ic0" "is_controller" (func $is_controller (param i32 i32) (result i32)))
  (import "ic0" "msg_arg_data_size" (func $msg_arg_data_size (result i32)))
  (import "ic0" "msg_arg_data_copy" (func $msg_arg_data_copy (param i32 i32 i32)))
  (import "ic0" "msg_reject_code" (func $msg_reject_code (result i32)))
  (import "ic0" "msg_reject_msg_size" (func $msg_reject_msg_size (result i32)))
  (import "ic0" "msg_reject_msg_copy" (func $msg_reject_msg_copy (param i32 i32 i32)))
  (import "ic0" "msg_reply_data_append" (func $msg_reply_data_append (param i32 i32)))
  (import "ic0" "msg_reply" (func $msg_reply))
  (import "ic0" "call_new" (func $call_new (param i32 i32 i32 i32 i32 i32 i32 i32)))
  (import "ic0" "call_data_append" (func $call_data_append (param i32 i32)))
  (import "ic0" "call_with_best_effort_response" (func $call_with_best_effort_response (param i32)))
  (import "ic0" "call_perform" (func $call_perform (result i32)))
  (import "ic0" "trap" (func $trap (param i32 i32)))

  (memory 1)
  (table 2 funcref)
  (elem (i32.const 0) $on_reply $on_reject)

  ;; Memory layout
  ;;     0..29    the caller
  ;;    32..      trap messages
  ;;  1020..1024  the reject code which starts the reply
  ;;  1024..      the args, or the callee's reply or reject message, the memory being grown to
  ;;              fit them. Each is only used within a single message, so they can share it.
  (data (i32.const 32) "caller is not a controller")
  (data (i32.const 64) "invalid args")
  (data (i32.const 96) "call_perform failed")

  (func $relay
    (local $caller_size i32)
    (local $size i32)
    (local $end i32)
    (local $callee_size i32)
    (local $method i32)
    (local $method_size i32)
    (local $payload i32)

    (local.set $caller_size (call $msg_caller_size))
    (call $msg_caller_copy (i32.const 0) (i32.const 0) (local.get $caller_size))
    (if (i32.eqz (call $is_controller (i32.const 0) (local.get $caller_size)))
      (then (call $trap (i32.const 32) (i32.const 26))))

    (local.set $size (call $msg_arg_data_size))
    (call $reserve (local.get $size))
    (call $msg_arg_data_copy (i32.const 1024) (i32.const 0) (local.get $size))
    (local.set $end (i32.add (i32.const 1024) (local.get $size)))

    ;; The callee (a principal is at most 29 bytes) starts at 1025 and is followed by the
    ;; method's length, which must fall within the args. Since the method then starts at 1026
    ;; or later, this also rejects args too short to hold the callee's length.
    (local.set $callee_size (i32.load8_u (i32.const 1024)))
    (local.set $method (i32.add (i32.const 1026) (local.get $callee_size)))
    (if (i32.or
          (i32.gt_u (local.get $callee_size) (i32.const 29))
          (i32.gt_u (local.get $method) (local.get $end)))
      (then (call $trap (i32.const 64) (i32.const 12))))

    (local.set $method_size (i32.load8_u (i32.sub (local.get $method) (i32.const 1))))
    (local.set $payload (i32.add (local.get $method) (local.get $method_size)))
    (if (i32.gt_u (local.get $payload) (local.get $end))
      (then (call $trap (i32.const 64) (i32.const 12))))

    (call $call_new
      (i32.const 1025) (local.get $callee_size)
      (local.get $method) (local.get $method_size)
      (i32.const 0) (i32.const 0)   ;; on_reply
      (i32.const 1) (i32.const 0))  ;; on_reject
    (call $call_data_append (local.get $payload) (i32.sub (local.get $end) (local.get $payload)))
    (call $call_with_best_effort_response (i32.const 30))
    (if (call $call_perform)
      (then (call $trap (i32.const 96) (i32.const 19)))))

  (func $on_reply (param $env i32)
    (local $size i32)
    (local.set $size (call $msg_arg_data_size))
    (call $reserve (local.get $size))
    (call $msg_arg_data_copy (i32.const 1024) (i32.const 0) (local.get $size))
    (call $reply (i32.const 0) (local.get $size)))

  (func $on_reject (param $env i32)
    (local $size i32)
    (local.set $size (call $msg_reject_msg_size))
    (call $reserve (local.get $size))
    (call $msg_reject_msg_copy (i32.const 1024) (i32.const 0) (local.get $size))
    (call $reply (call $msg_reject_code) (local.get $size)))

  ;; Replies with the reject code followed by the `size` bytes at 1024
  (func $reply (param $reject_code i32) (param $size i32)
    (i32.store (i32.const 1020) (local.get $reject_code))
    (call $msg_reply_data_append (i32.const 1020) (i32.add (i32.const 4) (local.get $size)))
    (call $msg_reply))

  ;; Grows the memory, if need be, so that `size` bytes fit from 1024. If it can't be grown the
  ;; copy which follows traps.
  (func $reserve (param $size i32)
    (local $pages i32)
    (local.set $pages
      (i32.sub
        (i32.shr_u (i32.add (local.get $size) (i32.const 66559)) (i32.const 16)) ;; 1024 + 65535
        (memory.size)))
    (if (i32.gt_s (local.get $pages) (i32.const 0))
      (then (drop (memory.grow (local.get $pages))))))

  (export "canister_update relay" (func $relay)))
