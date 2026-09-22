;; A minimal canister which sends (almost) all of its cycles to the CyclesDispenser.
;;
;; It exists so that the cycles held by the uninstalled canisters of deleted users can be
;; recovered: install this on such a canister, call `refund`, then uninstall it again.
;;
;; `refund` deposits everything above what the canister itself needs to complete the call
;; into the CyclesDispenser via the management canister's `deposit_cycles`, and replies
;; with the number of cycles sent (`nat64`).
;;
;; The target defaults to the production CyclesDispenser (gonut-hqaaa-aaaaf-aby7a-cai) and
;; can be overridden by passing `(principal "...")` as the init arg, eg. for ic_test.
;;
;; Build with: wat2wasm cycles_refunder.wat -o cycles_refunder.wasm
(module
  (import "ic0" "msg_arg_data_size" (func $msg_arg_data_size (result i32)))
  (import "ic0" "msg_arg_data_copy" (func $msg_arg_data_copy (param i32 i32 i32)))
  (import "ic0" "msg_reply" (func $msg_reply))
  (import "ic0" "msg_reply_data_append" (func $msg_reply_data_append (param i32 i32)))
  (import "ic0" "msg_reject" (func $msg_reject (param i32 i32)))
  (import "ic0" "msg_reject_msg_size" (func $msg_reject_msg_size (result i32)))
  (import "ic0" "msg_reject_msg_copy" (func $msg_reject_msg_copy (param i32 i32 i32)))
  (import "ic0" "canister_liquid_cycle_balance128" (func $liquid_balance (param i32)))
  (import "ic0" "cost_call" (func $cost_call (param i64 i64 i32)))
  (import "ic0" "call_new" (func $call_new (param i32 i32 i32 i32 i32 i32 i32 i32)))
  (import "ic0" "call_data_append" (func $call_data_append (param i32 i32)))
  (import "ic0" "call_with_best_effort_response" (func $call_with_best_effort_response (param i32)))
  (import "ic0" "call_cycles_add128" (func $call_cycles_add128 (param i64 i64)))
  (import "ic0" "call_perform" (func $call_perform (result i32)))
  (import "ic0" "trap" (func $trap (param i32 i32)))

  (memory 1)
  (table 2 funcref)
  (elem (i32.const 0) $on_reply $on_reject)

  ;; Memory layout
  ;;    0..16   liquid cycle balance (u128 LE), written by the system
  ;;   16..30   "deposit_cycles"
  ;;   32..78   candid `(record { canister_id : principal })`: a 15 byte header at 32..47
  ;;            followed by the principal value (at most 31 bytes), which defaults to
  ;;            gonut-hqaaa-aaaaf-aby7a-cai and is replaced by the init arg if one is given
  ;;   80..95   candid `(nat64)` reply, the value at 87..95 is filled in by `refund`
  ;;   96..112  cost of the deposit_cycles call (u128 LE), written by the system
  ;;  112..     trap messages
  ;; 1024..     init arg header / reject message buffer
  (data (i32.const 16) "deposit_cycles")
  (data (i32.const 32) "DIDL\01\6c\01\b3\c4\b1\f2\04\68\01\00\01\0a\00\00\00\00\00\a0\0e\3e\01\01")
  (data (i32.const 80) "DIDL\00\01\78")
  (data (i32.const 112) "call_perform failed")
  (data (i32.const 144) "refund already in progress")
  (data (i32.const 176) "cycle balance exceeds 2^64")
  (data (i32.const 208) "init arg must be (principal)")

  ;; Length of the candid encoded deposit_cycles arg at offset 32
  (global $payload_len (mut i32) (i32.const 27))

  ;; Set while a deposit_cycles call is outstanding, since the reply callback reads the
  ;; amount from memory shared by all messages
  (global $in_flight (mut i32) (i32.const 0))

  ;; Optional init arg `(principal)`, whose value replaces the default target
  (func $init
    (local $size i32)
    (local.set $size (call $msg_arg_data_size))
    (if (i32.gt_u (local.get $size) (i32.const 6))
      (then
        ;; Check for the 7 byte header "DIDL\00\01\68" and that the value fits
        (call $msg_arg_data_copy (i32.const 1024) (i32.const 0) (i32.const 7))
        (if (i32.or
              (i32.or
                (i32.ne (i32.load (i32.const 1024)) (i32.const 0x4c444944))
                (i32.ne (i32.load (i32.const 1027)) (i32.const 0x6801004c)))
              (i32.gt_u (local.get $size) (i32.const 38)))
          (then (call $trap (i32.const 208) (i32.const 28))))
        (local.set $size (i32.sub (local.get $size) (i32.const 7)))
        (call $msg_arg_data_copy (i32.const 47) (i32.const 7) (local.get $size))
        (global.set $payload_len (i32.add (i32.const 15) (local.get $size))))))

  (func $refund
    (local $balance i64)
    (local $slack i64)
    (local $keep i64)
    (local $amount i64)

    (if (global.get $in_flight)
      (then (call $trap (i32.const 144) (i32.const 26))))

    (call $liquid_balance (i32.const 0))
    (if (i64.ne (i64.load (i32.const 8)) (i64.const 0))
      (then (call $trap (i32.const 176) (i32.const 26))))
    (local.set $balance (i64.load (i32.const 0)))

    ;; The cost of the call, including the reservations for the largest possible response and
    ;; callback, all of which must remain in the canister on top of the amount being sent.
    (call $cost_call (i64.const 14) (i64.extend_i32_u (global.get $payload_len)) (i32.const 96))

    ;; On top of that a little slack may be needed. How much depends on the subnet and the
    ;; freezing threshold, so start small and double it each time the call is refused, since
    ;; the cycles are returned to the balance whenever `call_perform` fails.
    (local.set $slack (i64.const 16_000_000))

    (block $sent
      (loop $retry
        (local.set $keep (i64.add (i64.load (i32.const 96)) (local.get $slack)))
        (if (i64.lt_u (local.get $balance) (local.get $keep))
          (then
            ;; Nothing worth sending, reply with 0
            (i64.store (i32.const 87) (i64.const 0))
            (call $msg_reply_data_append (i32.const 80) (i32.const 15))
            (call $msg_reply)
            (return)))
        (local.set $amount (i64.sub (local.get $balance) (local.get $keep)))

        ;; Remember the amount so the reply callback can return it
        (i64.store (i32.const 87) (local.get $amount))

        ;; Callee is the management canister, whose principal is the empty blob
        (call $call_new
          (i32.const 0) (i32.const 0)   ;; callee
          (i32.const 16) (i32.const 14) ;; "deposit_cycles"
          (i32.const 0) (i32.const 0)   ;; on_reply
          (i32.const 1) (i32.const 0))  ;; on_reject
        (call $call_data_append (i32.const 32) (global.get $payload_len))
        ;; A best-effort call doesn't reserve a 2 MiB guaranteed-response slot, which would
        ;; otherwise raise the freezing threshold and so reduce what can be sent
        (call $call_with_best_effort_response (i32.const 300))
        (call $call_cycles_add128 (i64.const 0) (local.get $amount))
        (br_if $sent (i32.eqz (call $call_perform)))

        (local.set $slack (i64.shl (local.get $slack) (i64.const 1)))
        (br_if $retry (i64.lt_u (local.get $slack) (i64.const 1_000_000_000_000))))

      (call $trap (i32.const 112) (i32.const 19)))

    (global.set $in_flight (i32.const 1)))

  (func $on_reply (param $env i32)
    (global.set $in_flight (i32.const 0))
    (call $msg_reply_data_append (i32.const 80) (i32.const 15))
    (call $msg_reply))

  ;; Forward the reject message from deposit_cycles, capped at 4096 bytes
  (func $on_reject (param $env i32)
    (local $size i32)
    (global.set $in_flight (i32.const 0))
    (local.set $size (call $msg_reject_msg_size))
    (if (i32.gt_u (local.get $size) (i32.const 4096))
      (then (local.set $size (i32.const 4096))))
    (call $msg_reject_msg_copy (i32.const 1024) (i32.const 0) (local.get $size))
    (call $msg_reject (i32.const 1024) (local.get $size)))

  (export "canister_init" (func $init))
  (export "canister_update refund" (func $refund)))
