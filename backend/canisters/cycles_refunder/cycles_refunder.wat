;; A minimal canister which sends (almost) all of its cycles to the CyclesDispenser.
;;
;; It exists so that the cycles held by the uninstalled canisters of deleted users can be
;; recovered: install this on such a canister, call `refund`, then uninstall it again.
;;
;; `refund` deposits everything above what the canister itself needs to complete the call
;; into the CyclesDispenser via the management canister's `deposit_cycles`, and replies
;; with the number of cycles sent (`nat64`).
;;
;; Build with: wat2wasm cycles_refunder.wat -o cycles_refunder.wasm
(module
  (import "ic0" "msg_reply" (func $msg_reply))
  (import "ic0" "msg_reply_data_append" (func $msg_reply_data_append (param i32 i32)))
  (import "ic0" "msg_reject" (func $msg_reject (param i32 i32)))
  (import "ic0" "msg_reject_msg_size" (func $msg_reject_msg_size (result i32)))
  (import "ic0" "msg_reject_msg_copy" (func $msg_reject_msg_copy (param i32 i32 i32)))
  (import "ic0" "canister_liquid_cycle_balance128" (func $liquid_balance (param i32)))
  (import "ic0" "cost_call" (func $cost_call (param i64 i64 i32)))
  (import "ic0" "call_new" (func $call_new (param i32 i32 i32 i32 i32 i32 i32 i32)))
  (import "ic0" "call_data_append" (func $call_data_append (param i32 i32)))
  (import "ic0" "call_cycles_add128" (func $call_cycles_add128 (param i64 i64)))
  (import "ic0" "call_perform" (func $call_perform (result i32)))
  (import "ic0" "trap" (func $trap (param i32 i32)))

  (memory 1)
  (table 2 funcref)
  (elem (i32.const 0) $on_reply $on_reject)

  ;; Memory layout
  ;;    0..16   liquid cycle balance (u128 LE), written by the system
  ;;   16..30   "deposit_cycles"
  ;;   32..59   candid `(record { canister_id = principal "gonut-hqaaa-aaaaf-aby7a-cai" })`
  ;;   64..79   candid `(nat64)` reply, the value at 71..79 is filled in by `refund`
  ;;   80..96   cost of the deposit_cycles call (u128 LE), written by the system
  ;;   96..115  trap message
  ;; 1024..     reject message buffer
  (data (i32.const 16) "deposit_cycles")
  (data (i32.const 32) "DIDL\01\6c\01\b3\c4\b1\f2\04\68\01\00\01\0a\00\00\00\00\00\a0\0e\3e\01\01")
  (data (i32.const 64) "DIDL\00\01\78")
  (data (i32.const 96) "call_perform failed")

  (func $refund
    (local $lo i64)
    (local $hi i64)
    (local $slack i64)
    (local $keep i64)
    (local $amount_lo i64)
    (local $amount_hi i64)

    (call $liquid_balance (i32.const 0))
    (local.set $lo (i64.load (i32.const 0)))
    (local.set $hi (i64.load (i32.const 8)))

    ;; The cost of the call, including the reservations for the largest possible response and
    ;; callback, all of which must remain in the canister on top of the amount being sent.
    (call $cost_call (i64.const 14) (i64.const 27) (i32.const 80))

    ;; On top of that a little slack is needed, mostly because the reserved response slot raises
    ;; the freezing threshold slightly. How much depends on the subnet and the freezing
    ;; threshold, so start small and double it each time the call is refused, since the cycles
    ;; are returned to the balance whenever `call_perform` fails.
    (local.set $slack (i64.const 16_000_000))

    (block $sent
      (loop $retry
        (local.set $keep (i64.add (i64.load (i32.const 80)) (local.get $slack)))

        ;; amount = balance - keep, as a u128 with borrow
        (local.set $amount_hi (local.get $hi))
        (if (i64.lt_u (local.get $lo) (local.get $keep))
          (then
            (if (i64.eqz (local.get $hi))
              (then
                ;; Nothing worth sending, reply with 0
                (i64.store (i32.const 71) (i64.const 0))
                (call $msg_reply_data_append (i32.const 64) (i32.const 15))
                (call $msg_reply)
                (return)))
            (local.set $amount_hi (i64.sub (local.get $hi) (i64.const 1)))))
        (local.set $amount_lo (i64.sub (local.get $lo) (local.get $keep)))

        ;; Remember the amount (low 64 bits) so the reply callback can return it
        (i64.store (i32.const 71) (local.get $amount_lo))

        ;; Callee is the management canister, whose principal is the empty blob
        (call $call_new
          (i32.const 0) (i32.const 0)   ;; callee
          (i32.const 16) (i32.const 14) ;; "deposit_cycles"
          (i32.const 0) (i32.const 0)   ;; on_reply
          (i32.const 1) (i32.const 0))  ;; on_reject
        (call $call_data_append (i32.const 32) (i32.const 27))
        (call $call_cycles_add128 (local.get $amount_hi) (local.get $amount_lo))
        (br_if $sent (i32.eqz (call $call_perform)))

        (local.set $slack (i64.shl (local.get $slack) (i64.const 1)))
        (br_if $retry (i64.lt_u (local.get $slack) (i64.const 1_000_000_000_000))))

      (call $trap (i32.const 96) (i32.const 19))))

  (func $on_reply (param $env i32)
    (call $msg_reply_data_append (i32.const 64) (i32.const 15))
    (call $msg_reply))

  ;; Forward the reject message from deposit_cycles, capped at 4096 bytes
  (func $on_reject (param $env i32)
    (local $size i32)
    (local.set $size (call $msg_reject_msg_size))
    (if (i32.gt_u (local.get $size) (i32.const 4096))
      (then (local.set $size (i32.const 4096))))
    (call $msg_reject_msg_copy (i32.const 1024) (i32.const 0) (local.get $size))
    (call $msg_reject (i32.const 1024) (local.get $size)))

  (export "canister_update refund" (func $refund)))
