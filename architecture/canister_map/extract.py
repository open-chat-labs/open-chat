#!/usr/bin/env python3
"""Builds architecture/canister_map/index.html from the backend source.

For every canister crate under backend/canisters it reads:
  - the endpoints: every #[query(...)] / #[update(...)] / #[proposal(...)] in impl/src, with its guard
    and which encodings (candid / msgpack / json) it accepts, plus the Args / Response types from api/src
  - the state: the fields of the `Data` struct in impl/src/lib.rs, with their comments
  - the Metrics struct, the timer job types, the background jobs and the stable memory regions
  - who it calls: the `<x>_canister_c2c_client::<method>` uses, fire-and-forget sends and locally
    generated c2c calls in impl/src, plus the calls made by the modules of the shared libraries it uses
  - its init args, lifecycle hooks, latest released version and prod canister id

Run from the repo root:

    python3 architecture/canister_map/extract.py            # writes canister_map/index.html
    python3 architecture/canister_map/extract.py --live     # also refreshes live.json from prod metrics
    python3 architecture/canister_map/extract.py --out frontend/app/build/canister-map-<version>.html --live

index.html is produced by splicing the data into template.html, so the page stays a single file. The
website build runs the last form (see frontend/app/rollup.config.mjs) so the map is served from the
website canister, framed by its Architecture page, and regenerated on every deploy; with --out,
live.json is left alone.
"""

import argparse
import json
import re
import subprocess
import sys
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
CANISTERS = ROOT / "backend" / "canisters"
LIBRARIES = ROOT / "backend" / "libraries"
OUT_DIR = Path(__file__).resolve().parent

# Hand-written: what each canister is for. Everything else on the page is read from the code.
DESCRIPTIONS = {
    "user_index": {
        "title": "UserIndex",
        "zone": "users",
        "cardinality": "single",
        "summary": "The global registry of OpenChat users.",
        "detail": "Holds every user's principal, user id, username, display name, avatar, Diamond membership, "
        "CHIT balance and streak, suspension and moderation state. It registers users, creates the "
        "LocalUserIndexes and MultiUser canisters, upgrades them, takes Diamond payments, and runs the "
        "moderation pipeline for reported messages. Changes to a user are pushed to the LocalUserIndex that "
        "holds them so every canister on that subnet learns of them.",
    },
    "local_user_index": {
        "title": "LocalUserIndex",
        "zone": "users",
        "cardinality": "per-subnet",
        "summary": "One per subnet: creates and runs the chat canisters there.",
        "detail": "Each subnet OpenChat runs on has a LocalUserIndex. It holds a copy of the global user "
        "records, creates MultiUser, Group and Community canisters from a warm pool, upgrades and tops "
        "them up, and acts as the gateway for bots and for the web app's cross-chat calls. It also holds "
        "the notification queue and web push subscriptions for its users, the daily puzzle engine, and the "
        "message moderation queue, and refunds the cycles of uninstalled canisters.",
    },
    "multi_user": {
        "title": "MultiUser",
        "zone": "users",
        "cardinality": "many",
        "summary": "A few thousand users each: their chats and wallets.",
        "detail": "Replaces the one-canister-per-user design. Each MultiUser canister hosts a few thousand "
        "users: their direct chats and messages, the list of groups and communities they belong to, "
        "their settings, achievements, and the token accounts they send and receive from. Every endpoint "
        "acts as the calling user, so one canister serves all of its users without them seeing each "
        "other's data.",
    },
    "group_index": {
        "title": "GroupIndex",
        "zone": "chats",
        "cardinality": "single",
        "summary": "The registry of groups and communities.",
        "detail": "Knows every group and community, which LocalUserIndex created it, and which are public. "
        "Serves search and the explore page, routes creation to the LocalUserIndex with the fewest "
        "children, rolls out Group and Community upgrades across the subnets, and handles freezing, "
        "deletion and converting a group into a community.",
    },
    "group": {
        "title": "Group",
        "zone": "chats",
        "cardinality": "many",
        "summary": "A group chat: its members, messages and events.",
        "detail": "Stores the group's members and roles, every message and event, threads, polls, prize "
        "and P2P swap messages, rules, permissions, pinned messages and access gates. Events are kept in "
        "stable memory and served through the events queries; new activity is reported to the "
        "GroupIndex so the explore page stays fresh.",
    },
    "community": {
        "title": "Community",
        "zone": "chats",
        "cardinality": "many",
        "summary": "One canister per community, holding all of its channels.",
        "detail": "A community is a set of channels sharing one membership. The canister holds the members, "
        "every channel with its own messages and events, user groups, and the import of a group into a "
        "channel. Its API mirrors the Group canister's with a channel id on most calls.",
    },
    "identity": {
        "title": "Identity",
        "zone": "identity",
        "cardinality": "single",
        "summary": "Links sign-in methods to one OpenChat identity.",
        "detail": "Issues the delegation the web app signs calls with, so a user can sign in with Internet "
        "Identity, email, Ethereum or Solana and get the same OpenChat principal. Holds each user's "
        "auth principals and the WebAuthn keys and account linking codes that join them.",
    },
    "sign_in_with_email": {
        "title": "SignInWithEmail",
        "zone": "identity",
        "cardinality": "single",
        "summary": "Email magic links as a sign-in method.",
        "detail": "Generates a magic link for an email address, sends it through an HTTPS outcall to the email "
        "provider, and on return issues a delegation for a principal derived from the address. The "
        "Identity canister then links that principal to the user.",
    },
    "online_users": {
        "title": "OnlineUsers",
        "zone": "identity",
        "cardinality": "single",
        "summary": "Who is online right now, and the minutes online leaderboard.",
        "detail": "The web app calls mark_as_online every minute while signed in. The canister answers "
        "last-online queries and keeps per-user minutes online for streak and leaderboard purposes.",
    },
    "notifications_index": {
        "title": "NotificationsIndex",
        "zone": "notifications",
        "cardinality": "single",
        "summary": "Push subscriptions; the entry point for the pushers.",
        "detail": "Holds each user's web push subscriptions and the principals of the off-chain notification "
        "pushers, and tells every LocalUserIndex about them so the pushers can read the notification "
        "queue held on each subnet.",
    },
    "storage_index": {
        "title": "StorageIndex",
        "zone": "storage",
        "cardinality": "single",
        "summary": "Per-user byte allowances, and which bucket holds each file.",
        "detail": "Tracks every user's storage allowance and usage, the content-addressed blobs and which "
        "StorageBucket holds each, creates a new bucket when the active ones fill, and holds the "
        "CSAM hash denylist the buckets check uploads against.",
    },
    "storage_bucket": {
        "title": "StorageBucket",
        "zone": "storage",
        "cardinality": "many",
        "summary": "Holds the file bytes behind message attachments.",
        "detail": "Files are uploaded in chunks and served over HTTP on the raw domain. Each file has an "
        "owner and a set of accessors (the chat canisters that may read it); a bucket becomes read-only "
        "once full. Syncs its usage back to the StorageIndex.",
    },
    "registry": {
        "title": "Registry",
        "zone": "platform",
        "cardinality": "single",
        "summary": "The tokens, SNSes and subnets OpenChat knows about.",
        "detail": "Any user can propose adding a token; the Registry validates it against the ledger, "
        "charges the fee and lists it. It also tracks SNS nervous systems for the ProposalsBot, "
        "message filters, swap providers, and expands OpenChat onto a new subnet by creating that "
        "subnet's LocalUserIndex.",
    },
    "escrow": {
        "title": "Escrow",
        "zone": "tokens",
        "cardinality": "single",
        "summary": "Holds both sides of a token swap until it completes.",
        "detail": "A P2P swap message in a chat creates a swap here. Each party deposits into a swap "
        "subaccount; once both have, the Escrow sends each party the other's tokens, or refunds "
        "them when the swap is cancelled or expires.",
    },
    "cycles_dispenser": {
        "title": "CyclesDispenser",
        "zone": "platform",
        "cardinality": "single",
        "summary": "Tops up every OpenChat canister with cycles.",
        "detail": "Authorized canisters ask it for cycles when low. It burns ICP from its account through the "
        "Cycles Minting Canister to stay stocked, and the SNS tops up the account by proposal.",
    },
    "openchat_installer": {
        "title": "OpenChatInstaller",
        "zone": "platform",
        "cardinality": "single",
        "summary": "Installs and upgrades the large index canisters by proposal.",
        "detail": "The UserIndex, GroupIndex and NotificationsIndex wasms exceed the size a single SNS "
        "proposal can carry, so their wasm is uploaded in chunks here and a proposal tells the "
        "installer to upgrade the canister from them.",
    },
    "event_relay": {
        "title": "EventRelay",
        "zone": "platform",
        "cardinality": "single",
        "summary": "Collects analytics events for the event store.",
        "detail": "Canisters push anonymised product events here; the relay batches them to the external "
        "event store canister. It also reads the CHAT ledger to record token burns.",
    },
    "translations": {
        "title": "Translations",
        "zone": "platform",
        "cardinality": "single",
        "summary": "Community translations of the web app's strings.",
        "detail": "Users propose translations for the interface in their language; approved ones are paid "
        "a CHAT reward and merged into the app's language files at release time.",
    },
    "daily_puzzle": {
        "title": "DailyPuzzle",
        "zone": "platform",
        "cardinality": "single",
        "summary": "Generates the daily puzzles and keeps the results.",
        "detail": "Produces each day's puzzles, pushes them to every LocalUserIndex at the rollover, and "
        "collects results and streaks back from them.",
    },
    "proposals_bot": {
        "title": "ProposalsBot",
        "zone": "governance",
        "cardinality": "single",
        "summary": "Mirrors NNS and SNS proposals into chat and votes on them.",
        "detail": "Polls each registered governance canister for new proposals and posts them as proposal "
        "messages in the matching channel, keeps their tallies updated, and lets users vote from the "
        "chat with the neurons they control. Can also submit proposals on users' behalf.",
    },
    "proposal_validation": {
        "title": "ProposalValidation",
        "zone": "governance",
        "cardinality": "single",
        "summary": "Renders custom SNS proposals for voters to read.",
        "detail": "The OpenChat SNS calls it to validate and render the payload of custom-function "
        "proposals, such as voting an NNS neuron, so that voters see a readable description.",
    },
    "neuron_controller": {
        "title": "NeuronController",
        "zone": "governance",
        "cardinality": "single",
        "summary": "Controls the SNS treasury's NNS neurons.",
        "detail": "Holds the threshold-ECDSA key that controls OpenChat's NNS neurons, votes them, "
        "refreshes and spawns their maturity, and moves the ICP rewards to the treasury.",
    },
    "call_relay": {
        "title": "CallRelay",
        "zone": "platform",
        "cardinality": "ephemeral",
        "summary": "A tiny wasm that moves an old user canister's funds out.",
        "detail": "Written directly in WebAssembly text. When a migrated user's old canister still holds "
        "tokens, the LocalUserIndex installs this on it, relays ledger transfers as the canister, then "
        "uninstalls it.",
    },
    "cycles_refunder": {
        "title": "CyclesRefunder",
        "zone": "platform",
        "cardinality": "ephemeral",
        "summary": "Takes back the cycles left in an uninstalled canister.",
        "detail": "Written directly in WebAssembly text. The LocalUserIndex installs it on the uninstalled "
        "canisters of deleted users, groups and communities; it sends their spare cycles to the "
        "CyclesDispenser and is then uninstalled.",
    },
}

# Canisters still in the tree but no longer part of the system
DEPRECATED = {"market_maker"}

ZONES = {
    "identity": "Identity",
    "users": "Users",
    "chats": "Groups & communities",
    "storage": "File storage",
    "notifications": "Notifications",
    "tokens": "Tokens & swaps",
    "governance": "Governance & treasury",
    "platform": "Platform",
}

# External canisters reached through c2c clients, keyed by the client crate's prefix.
EXTERNALS = {
    "icrc_ledger": ("ICRC ledgers", "CHAT, ckBTC, ckETH and every other token OpenChat lists"),
    "icp_ledger": ("ICP ledger", "The NNS ICP ledger"),
    "cycles_minting": ("Cycles Minting Canister", "NNS: converts ICP to cycles, creates canisters"),
    "nns_governance": ("NNS Governance", "Network Nervous System proposals and neurons"),
    "sns_governance": ("SNS Governance", "OpenChat's own and other SNS governance canisters"),
    "sns_ledger": ("SNS ledger", "The CHAT ledger"),
    "sns_archive": ("SNS ledger archive", "Older CHAT ledger blocks"),
    "sns_root": ("SNS Root", "Controller of the OpenChat SNS canisters"),
    "sns_swap": ("SNS Swap", "Decentralisation swap state of an SNS"),
    "sns_wasm": ("SNS-W", "NNS registry of deployed SNSes"),
    "ckbtc_minter": ("ckBTC minter", "Bitcoin in and out"),
    "cksol_minter": ("ckSOL minter", "Solana in and out"),
    "one_sec_minter": ("OneSec minter", "Bridged ERC-20 tokens"),
    "icpswap_swap_pool": ("ICPSwap", "Swap pools"),
    "taco_exchange": ("TACO", "Swap aggregator"),
    "management": ("IC management canister", "create_canister, install_code, deposit_cycles, raw_rand, ECDSA signing, HTTPS outcalls"),
    "event_store": ("Event store", "Anonymised product analytics"),
}

# Off-chain actors recognised by a guard name fragment.
OFFCHAIN = {
    "notification_pusher": ("Notification pusher", "Off-chain service that reads the notification queues and sends web push and FCM messages"),
    "push_service": ("Notification pusher", "Off-chain service that reads the notification queues and sends web push and FCM messages"),
    "media_scanner": ("Media scanner", "Off-chain worker that hashes uploaded media and checks it against CSAM databases"),
    "video_call_operator": ("Video bridge", "Daily.co bridge that starts and ends video calls"),
    "authority_reporter": ("Authority reporter", "Off-chain service filing legally required reports"),
}

# utils::canister helpers that wrap a management canister call, and what they call
UTILS_CANISTER_CALLS = {
    "create": "create_canister",
    "install": "install_code",
    "install_basic": "install_code",
    "uninstall": "uninstall_code",
    "start": "start_canister",
    "stop": "stop_canister",
    "deposit_cycles": "deposit_cycles",
    "canister_status": "canister_status",
    "set_controllers": "update_settings",
    "set_freezing_threshold": "update_settings",
    "get_random_seed": "raw_rand",
    "try_get_random_seed": "raw_rand",
    "upload_wasm_in_chunks": "upload_chunk",
    "clear_chunk_store": "clear_chunk_store",
    "delete": "delete_canister",
    "upgrade": "install_code",
}

ATTR_RE = re.compile(r"^\s*#\[(query|update|proposal)\s*(?:\(([^)]*)\))?\]\s*$")
FN_RE = re.compile(r"^\s*(?:pub(?:\([^)]*\))?\s+)?(?:async\s+)?fn\s+([a-zA-Z0-9_]+)")
C2C_RE = re.compile(r"\b([a-z_0-9]+)_canister_c2c_client::([a-z_0-9]+)\b")
C2C_BRACE_RE = re.compile(r"\buse ([a-z_0-9]+)_canister_c2c_client::\{([^}]*)\}", re.S)
FAF_RE = re.compile(r"fire_and_forget_handler\s*\.send\(\s*([^,]+?),\s*\"([a-z_0-9]+)\"", re.S)
LOCAL_C2C_RE = re.compile(r"generate_[a-z_]*c2c_call[a-z_]*!\(\s*([a-z_0-9]+)\s*\)")
VERSION_RE = re.compile(r"^## \[\[(\d+\.\d+\.\d+)\]\(([^)]+)\)\] - (\d{4}-\d{2}-\d{2})", re.M)


def read(path):
    try:
        return path.read_text(encoding="utf-8")
    except FileNotFoundError:
        return ""


def rust_files(directory):
    if not directory.exists():
        return []
    return sorted(p for p in directory.rglob("*.rs"))


def parse_attr_args(args):
    flags = {"candid": False, "msgpack": False, "json": False, "composite": False, "hidden": False, "guard": None}
    if not args:
        return flags
    for part in re.split(r",\s*", args.strip()):
        if "=" not in part:
            continue
        key, value = [p.strip() for p in part.split("=", 1)]
        value = value.strip('"')
        if key == "guard":
            flags["guard"] = value
        elif key in flags:
            flags[key] = value == "true"
    return flags


def leading_comment(lines, index):
    """The // comment block directly above lines[index], if any."""
    out = []
    i = index - 1
    while i >= 0:
        line = lines[i].strip()
        if line.startswith("//"):
            out.insert(0, line.lstrip("/").strip())
            i -= 1
        elif line.startswith("#[") or line == "":
            # skip other attributes such as #[trace], but stop at a blank line once we have text
            if line == "" and out:
                break
            i -= 1
        else:
            break
    return " ".join(out).strip()


def endpoint(name, kind, flags, comment, rel, proposal=False):
    return {
        "name": name,
        "kind": kind,
        "guard": flags["guard"],
        "candid": flags["candid"],
        "msgpack": flags["msgpack"],
        "json": flags["json"],
        "composite": flags["composite"],
        "hidden": flags["hidden"],
        "c2c": name.startswith("c2c_") or name.endswith("_c2c"),
        "proposal": proposal,
        "comment": comment,
        "file": rel,
    }


def extract_endpoints(impl_src):
    endpoints = []
    for path in rust_files(impl_src):
        lines = read(path).splitlines()
        for i, line in enumerate(lines):
            m = ATTR_RE.match(line)
            if not m:
                continue
            kind, args = m.group(1), m.group(2)
            flags = parse_attr_args(args)
            if not (flags["candid"] or flags["msgpack"] or flags["json"]):
                # ic_cdk's own #[query] / #[update], or no encoding named: candid only
                flags["candid"] = True
            name = None
            for j in range(i + 1, min(i + 8, len(lines))):
                fm = FN_RE.match(lines[j])
                if fm:
                    name = fm.group(1)
                    break
            if not name:
                continue
            comment = leading_comment(lines, i)
            rel = str(path.relative_to(ROOT))
            if kind == "proposal":
                # The proposal macro emits a candid update plus a `<name>_validate` query the SNS
                # calls to render the proposal for voters
                flags.update(candid=True, msgpack=False, json=False)
                endpoints.append(endpoint(name, "update", flags, comment, rel, proposal=True))
                endpoints.append(endpoint(name + "_validate", "query", flags, "Renders the proposal payload for voters; generated by #[proposal]", rel, proposal=True))
            else:
                endpoints.append(endpoint(name, kind, flags, comment, rel))
    endpoints.sort(key=lambda e: (e["kind"] != "query", e["name"], not e["proposal"]))
    return endpoints


def wire_names(e):
    """The method names the endpoint is exported under (canister_api_macros adds a suffix per encoding)."""
    names = []
    if e["candid"] or e["proposal"]:
        names.append(e["name"])
    if e["msgpack"]:
        names.append(e["name"] + "_msgpack")
    if e["json"]:
        names.append(e["name"] + "_json")
    return names or [e["name"]]


def strip_api_source(text):
    """Keeps the Args / Response definitions of an api module, dropping imports and derives."""
    kept = []
    in_use = False
    for line in text.splitlines():
        s = line.strip()
        if in_use:
            if s.endswith(";"):
                in_use = False
            continue
        if s.startswith("use "):
            in_use = not s.endswith(";")
            continue
        if s.startswith("#[derive") or s.startswith("#[ts_export"):
            continue
        if s.startswith("#[cfg(") or s.startswith("mod tests") or s.startswith("#[test]"):
            break
        kept.append(line.rstrip())
    out = "\n".join(kept).strip("\n")
    return re.sub(r"\n{3,}", "\n\n", out)


def extract_api_types(api_src):
    """Maps api module name -> trimmed source of its Args / Response."""
    types = {}
    for sub in ("queries", "updates"):
        d = api_src / sub
        if not d.exists():
            continue
        for path in sorted(d.glob("*.rs")):
            if path.name != "mod.rs":
                types[path.stem] = strip_api_source(read(path))
    return types


def extract_struct(text, name):
    """Returns the fields of `struct <name> {` with any comment lines above each field."""
    m = re.search(r"^(?:pub(?:\([^)]*\))?\s+)?struct " + re.escape(name) + r"\s*(?:<[^>]*>)?\s*\{", text, re.M)
    if not m:
        return None
    body_lines = []
    depth = 0
    for line in text[m.start():].splitlines():
        depth += line.count("{") - line.count("}")
        body_lines.append(line)
        if depth <= 0 and len(body_lines) > 1:
            break
    fields = []
    comment = []
    attrs = []
    for raw in body_lines[1:-1]:
        s = raw.strip()
        if not s:
            continue
        if s.startswith("//"):
            comment.append(s.lstrip("/").strip())
            continue
        if s.startswith("#["):
            attrs.append(s)
            continue
        fm = re.match(r"(?:pub(?:\([^)]*\))?\s+)?([a-zA-Z0-9_]+)\s*:\s*(.+?),?$", s)
        if fm:
            fields.append(
                {
                    "name": fm.group(1),
                    "type": fm.group(2).rstrip(","),
                    "comment": " ".join(comment),
                    "serde_skip": any("skip" in a and "serde" in a for a in attrs),
                    "deprecated": any("deprecated" in a for a in attrs),
                }
            )
        comment, attrs = [], []
    return fields


def extract_enum_variants(text, name):
    m = re.search(r"^(?:pub\s+)?enum " + re.escape(name) + r"\s*\{", text, re.M)
    if not m:
        return []
    variants = []
    depth = 0
    comment = []
    for idx, line in enumerate(text[m.start():].splitlines()):
        depth += line.count("{") - line.count("}")
        if idx == 0:
            continue
        s = line.strip()
        if s.startswith("//"):
            comment.append(s.lstrip("/").strip())
            continue
        vm = re.match(r"([A-Z][A-Za-z0-9_]*)", s)
        if vm and depth >= 1:
            variants.append({"name": vm.group(1), "comment": " ".join(comment)})
            comment = []
        if depth <= 0:
            break
    return variants


def extract_jobs(impl_src):
    jobs = []
    d = impl_src / "jobs"
    if d.exists():
        for path in sorted(d.glob("*.rs")):
            if path.name == "mod.rs":
                continue
            comment = []
            for line in read(path).splitlines():
                s = line.strip()
                if s.startswith("//"):
                    comment.append(s.lstrip("/").strip())
                elif s.startswith("use ") or s == "":
                    if comment:
                        break
                else:
                    break
            jobs.append({"name": path.stem, "comment": " ".join(comment), "file": str(path.relative_to(ROOT))})
    regular = impl_src / "regular_jobs.rs"
    if regular.exists():
        for m in re.finditer(r"RegularJob::new\(\s*\"([^\"]+)\"\s*,\s*([a-z_0-9:]+)", read(regular)):
            jobs.append({"name": m.group(1), "comment": "Regular job run on activity: " + m.group(2), "file": str(regular.relative_to(ROOT))})
    return jobs


def extract_memory(impl_src):
    text = read(impl_src / "memory.rs")
    return [{"name": m.group(1), "id": int(m.group(2))} for m in re.finditer(r"const ([A-Z_0-9]+): MemoryId = MemoryId::new\((\d+)\);", text)]


def extract_guards(impl_src):
    """guard fn name -> who passes it, from the error message it returns."""
    text = read(impl_src / "guards.rs")
    guards = {}
    for m in re.finditer(r"pub fn ([a-z_0-9]+)\(\)[^{]*\{(.*?)\n\}", text, re.S):
        name, body = m.group(1), m.group(2)
        em = re.search(r"Err\(\"([^\"]+)\"", body)
        label = None
        if em:
            msg = em.group(1)
            stripped = re.sub(r"^Caller (?:is not|not recognised as) ", "", msg)
            if stripped != msg:
                label = stripped.rstrip(".")
        guards[name] = label or name.replace("caller_is_", "").replace("_", " ")
    return guards


def extract_init_args(api_src):
    for name in ("init.rs", "init_or_upgrade.rs"):
        text = read(api_src / "lifecycle" / name)
        if text:
            fields = extract_struct(text, "Args") or extract_struct(text, "InitArgs") or extract_struct(text, "InitOrUpgradeArgs")
            if fields:
                return fields
    return []


def extract_lifecycle(impl_src):
    d = impl_src / "lifecycle"
    return [p.stem for p in sorted(d.glob("*.rs")) if p.name != "mod.rs"] if d.exists() else []


def extract_version(canister_dir):
    m = VERSION_RE.search(read(canister_dir / "CHANGELOG.md"))
    return {"version": m.group(1), "url": m.group(2), "date": m.group(3)} if m else None


def add_call(calls, target, method, via=None):
    entry = calls.setdefault(target, {"methods": set(), "via": set()})
    entry["methods"].add(method)
    if via:
        entry["via"].add(via)


def c2c_client_calls(text):
    """target -> methods called through a `<target>_canister_c2c_client` in this source text."""
    calls = {}
    for m in C2C_RE.finditer(text):
        target, method = m.group(1), m.group(2)
        if not method[0].isupper() and method not in ("Args", "Response"):
            calls.setdefault(target, set()).add(method)
    for m in C2C_BRACE_RE.finditer(text):
        for item in m.group(2).split(","):
            ident = item.strip().split("::")[0].strip()
            if ident and ident != "self" and not ident[0].isupper():
                calls.setdefault(m.group(1), set()).add(ident)
    return calls


def module_of(path, src):
    """The top-level module a library source file belongs to ('lib' for lib.rs)."""
    rel = path.relative_to(src)
    return "lib" if rel.name == "lib.rs" else rel.parts[0].replace(".rs", "")


def library_calls():
    """library crate -> module -> (target -> methods), for the shared libraries that make c2c calls."""
    out = {}
    for lib in sorted(LIBRARIES.iterdir()):
        src = lib / "src"
        if not src.exists():
            continue
        for path in rust_files(src):
            calls = c2c_client_calls(read(path))
            if calls:
                mod = out.setdefault(lib.name, {}).setdefault(module_of(path, src), {})
                for t, ms in calls.items():
                    mod.setdefault(t, set()).update(ms)
    return out


def cargo_deps(cargo_toml):
    deps = set()
    in_deps = False
    for line in read(cargo_toml).splitlines():
        s = line.strip()
        if s.startswith("["):
            in_deps = s == "[dependencies]"
        elif in_deps:
            m = re.match(r"([A-Za-z0-9_\-]+)(?:\.workspace)?\s*=", s)
            if m:
                deps.add(m.group(1))
    return deps


def canister_ids():
    data = json.loads(read(ROOT / "canister_ids.json") or "{}")
    return {k: v.get("ic") for k, v in data.items() if isinstance(v, dict)}


def fetch_metrics(canister_id):
    try:
        with urllib.request.urlopen(f"https://{canister_id}.raw.icp0.io/metrics", timeout=20) as r:
            return json.load(r)
    except Exception as e:  # noqa: BLE001 - a missing figure is fine, the page says so
        print(f"  metrics for {canister_id} unavailable: {e}", file=sys.stderr)
        return None


def live_counts(ids):
    """A handful of headline figures from prod metrics, keyed by canister."""
    counts = {}
    m = fetch_metrics(ids["user_index"])
    if m:
        counts["user_index"] = [("users", m.get("users_created"))]
        counts["local_user_index"] = [("canisters on prod", len(m.get("local_user_indexes", [])))]
        counts["multi_user"] = [("canisters on prod", len(m.get("multi_user_canisters", [])))]
    m = fetch_metrics(ids["group_index"])
    if m:
        counts["group"] = [("public groups", m.get("public_groups")), ("private groups", m.get("private_groups"))]
        counts["community"] = [("public communities", m.get("public_communities")), ("private communities", m.get("private_communities"))]
    m = fetch_metrics(ids["storage_index"])
    if m:
        counts["storage_index"] = [("files", m.get("file_count")), ("GB stored", round((m.get("total_file_bytes") or 0) / 1e9))]
        counts["storage_bucket"] = [("active buckets", len(m.get("active_buckets", [])))]
    m = fetch_metrics(ids["notifications_index"])
    if m:
        counts["notifications_index"] = [("web push subscriptions", m.get("subscriptions"))]
    m = fetch_metrics(ids["identity"])
    if m:
        counts["identity"] = [("identities", m.get("user_principals")), ("auth principals", m.get("auth_principals"))]
    m = fetch_metrics(ids["online_users"])
    if m:
        counts["online_users"] = [("mark_as_online calls", m.get("mark_as_online_count"))]
    return {k: [[label, v] for (label, v) in pairs if v is not None] for k, pairs in counts.items()}


def wat_canister(name, d):
    readme = read(d / "README.md")
    if name == "call_relay":
        flags = parse_attr_args("")
        flags["guard"] = "controller"
        eps = [endpoint("relay", "update", flags, "Raw args: callee | method | payload. Calls the method as this canister and relays the reply.", "backend/canisters/call_relay/call_relay.wat")]
        externals = {"icrc_ledger": {"methods": ["icrc1_transfer (relayed)"], "via": []}}
        calls = {}
    else:
        flags = parse_attr_args("candid = true")
        eps = [endpoint("refund", "update", flags, "Sends all spare cycles to the CyclesDispenser and returns how many were sent.", "backend/canisters/cycles_refunder/cycles_refunder.wat")]
        externals = {"management": {"methods": ["deposit_cycles"], "via": []}}
        calls = {"cycles_dispenser": {"methods": ["deposit_cycles (a management canister call that credits the CyclesDispenser)"], "via": []}}
    return eps, calls, externals, readme, len(read(d / f"{name}.wat").splitlines())


def git_commit():
    try:
        return subprocess.run(["git", "-C", str(ROOT), "rev-parse", "--short", "HEAD"], capture_output=True, text=True, check=True).stdout.strip()
    except (OSError, subprocess.CalledProcessError):
        # eg. a Docker build, which copies the tree without .git
        return ""


def build():
    ids = canister_ids()
    lib_calls = library_calls()
    canisters = {}
    sources = {}

    for d in sorted(CANISTERS.iterdir()):
        name = d.name
        if name in DEPRECATED:
            continue
        if name not in DESCRIPTIONS:
            print(f"  skipping {name}: no description", file=sys.stderr)
            continue
        impl_src = d / "impl" / "src"
        api_src = d / "api" / "src"
        desc = DESCRIPTIONS[name]
        entry = {
            "id": name,
            "title": desc["title"],
            "zone": desc["zone"],
            "cardinality": desc["cardinality"],
            "summary": desc["summary"],
            "detail": desc["detail"],
            "canister_id": ids.get(name) if desc["cardinality"] == "single" else None,
            "version": extract_version(d),
            "endpoints": [],
            "api_types": {},
            "state": [],
            "metrics": [],
            "timer_jobs": [],
            "jobs": [],
            "memory": [],
            "guards": {},
            "init_args": [],
            "lifecycle": [],
            "calls": {},
            "externals": {},
            "offchain": {},
            "libraries": [],
            "loc": 0,
            "path": str(d.relative_to(ROOT)),
        }

        if impl_src.exists():
            lib_text = read(impl_src / "lib.rs")
            entry["endpoints"] = extract_endpoints(impl_src)
            for pm in re.finditer(r"proposal_validation!\(\s*([a-z_0-9]+)\s*,\s*([a-z_0-9]+)", lib_text):
                flags = parse_attr_args("candid = true")
                entry["endpoints"].append(endpoint(f"{pm.group(1)}_{pm.group(2)}_validate", "query", flags, f"Renders a {pm.group(1)} {pm.group(2)} proposal payload as text for voters", str((impl_src / "lib.rs").relative_to(ROOT)), proposal=True))
            entry["api_types"] = extract_api_types(api_src)
            entry["state"] = extract_struct(lib_text, "Data") or extract_struct(read(impl_src / "state.rs"), "State") or []
            entry["metrics"] = extract_struct(lib_text, "Metrics") or []
            entry["timer_jobs"] = extract_enum_variants(read(impl_src / "timer_job_types.rs"), "TimerJob")
            entry["jobs"] = extract_jobs(impl_src)
            entry["memory"] = extract_memory(impl_src)
            entry["guards"] = extract_guards(impl_src)
            entry["init_args"] = extract_init_args(api_src)
            entry["lifecycle"] = extract_lifecycle(impl_src)
            entry["loc"] = sum(len(read(p).splitlines()) for p in rust_files(impl_src))
            sources[name] = {str(p): read(p) for p in rust_files(impl_src)}
            entry["deps"] = cargo_deps(d / "impl" / "Cargo.toml")

            for e in entry["endpoints"]:
                g = e["guard"] or ""
                for frag, (label, _) in OFFCHAIN.items():
                    if frag in g:
                        entry["offchain"].setdefault(label, []).append(e["name"])
        else:
            eps, calls, externals, readme, loc = wat_canister(name, d)
            entry.update(endpoints=eps, calls=calls, externals=externals, readme=readme, loc=loc)

        # Which endpoints the web app calls directly (ts_export in api/src/main.rs)
        main_rs = read(api_src / "main.rs")
        ts = set(re.findall(r"generate_ts_method!\(\s*[a-z_]+\s*,\s*([a-z_0-9]+)", main_rs))
        candid = set(re.findall(r"generate_candid_method!\(\s*[a-z_]+\s*,\s*([a-z_0-9]+)", main_rs))
        for e in entry["endpoints"]:
            base = re.sub(r"_(v2|v3)$", "", e["name"])
            e["frontend"] = not e["proposal"] and not e["c2c"] and (e["name"] in ts or base in ts)
            e["in_did"] = e["candid"] or e["name"] in candid or base in candid
            e["wire"] = wire_names(e)
            stem = Path(e["file"]).stem
            e["api"] = next((k for k in (e["name"], base, re.sub(r"_(c2c|validate)$", "", e["name"]), stem) if k in entry["api_types"]), None)

        canisters[name] = entry

    # Second pass: the calls each canister makes, which needs every canister's endpoints to resolve
    # the targets of calls that don't name their target crate
    def canisters_with_endpoint(method):
        base = re.sub(r"_(msgpack|json)$", "", method)
        return [n for n, c in canisters.items() if any(e["name"] == base for e in c["endpoints"])]

    for name, entry in canisters.items():
        if name not in sources:
            continue
        calls = {}
        all_text = "\n".join(sources[name].values())
        for target, methods in c2c_client_calls(all_text).items():
            for m in methods:
                add_call(calls, target, m)
        for text in sources[name].values():
            for m in FAF_RE.finditer(text):
                expr, method = m.group(1), m.group(2)
                tm = re.search(r"\b([a-z_0-9]+?)_canister(?:_id)?\b", expr)
                targets = [tm.group(1)] if tm and tm.group(1) in canisters else [t for t in canisters_with_endpoint(method) if t != name]
                for t in targets:
                    add_call(calls, t, method)
            for m in LOCAL_C2C_RE.finditer(text):
                method = m.group(1)
                um = re.search(r"\buse ([a-z_0-9]+)_canister::(?:\{[^}]*\b)?" + re.escape(method) + r"\b", text)
                targets = [um.group(1)] if um and um.group(1) in canisters else [t for t in canisters_with_endpoint(method) if t != name]
                for t in targets:
                    add_call(calls, t, method)
        if "init_cycles_dispenser_client" in all_text:
            add_call(calls, "cycles_dispenser", "c2c_request_cycles", "utils")
        for lib, modules in lib_calls.items():
            if lib not in entry["deps"]:
                continue
            referenced = set(re.findall(r"\b" + re.escape(lib) + r"::([a-z_0-9]+)", all_text))
            for bm in re.finditer(r"\buse " + re.escape(lib) + r"::\{([^}]*)\}", all_text, re.S):
                referenced.update(i.strip().split("::")[0].strip() for i in bm.group(1).split(","))
            used = False
            for module, targets in modules.items():
                if (module == "lib" and referenced) or module in referenced:
                    used = True
                    for t, ms in targets.items():
                        for m in ms:
                            add_call(calls, t, m, lib)
            if used:
                entry["libraries"].append(lib)
        mgmt = set()
        helpers = set(re.findall(r"\butils::canister::([a-z_0-9]+)", all_text))
        for bm in re.finditer(r"\buse utils::canister::\{([^}]*)\}", all_text, re.S):
            helpers.update(i.strip() for i in bm.group(1).split(","))
        mgmt.update(UTILS_CANISTER_CALLS[h] for h in helpers if h in UTILS_CANISTER_CALLS)
        mgmt.update(m for m in re.findall(r"management_canister::([a-z][a-z_0-9]*)\b", all_text) if m != "self")
        if "HttpRequestArgs" in all_text or "http_request_with_closure" in all_text:
            mgmt.add("http_request (HTTPS outcall)")
        if name == "sign_in_with_email":
            mgmt.update(["http_request (HTTPS outcall to the email provider)", "sign_with_ecdsa"])
        if mgmt:
            calls["management"] = {"methods": mgmt, "via": set()}
        if "event_store_producer" in entry["deps"] and name != "event_relay":
            add_call(calls, "event_relay", "push_events", "event_store_producer")
        if name == "event_relay":
            add_call(calls, "event_store", "push_events")

        internal, external = {}, {}
        for t, c in calls.items():
            packed = {"methods": sorted(c["methods"]), "via": sorted(c["via"])}
            if t in canisters:
                internal[t] = packed
            elif t in EXTERNALS:
                external[t] = packed
            else:
                print(f"  {name}: unclassified call target {t}", file=sys.stderr)
        entry["calls"] = internal
        entry["externals"] = external
        del entry["deps"]

    for entry in canisters.values():
        entry["called_by"] = {}
    for name, entry in canisters.items():
        for target, c in entry["calls"].items():
            canisters[target]["called_by"][name] = c

    return {
        "generated": datetime.now(timezone.utc).strftime("%Y-%m-%d"),
        "commit": git_commit(),
        "zones": ZONES,
        "externals": {k: {"title": v[0], "detail": v[1]} for k, v in EXTERNALS.items()},
        "offchain": {v[0]: v[1] for v in OFFCHAIN.values()},
        "canisters": canisters,
    }


def main():
    parser = argparse.ArgumentParser(description="Builds the canister map page from the backend source")
    parser.add_argument("--out", type=Path, default=OUT_DIR / "index.html", help="where to write the page (default: beside this script)")
    parser.add_argument("--live", action="store_true", help="fetch the headline counts from the prod canisters' /metrics")
    args = parser.parse_args()
    out = args.out.resolve()
    out.parent.mkdir(parents=True, exist_ok=True)
    data = build()

    # The prod counts are kept in live.json between runs, so a plain run doesn't touch the network.
    # --live fetches them afresh, canister by canister, keeping the file's figure for any canister
    # whose metrics can't be read; the file itself is only rewritten when the page is built in place.
    live_file = OUT_DIR / "live.json"
    counts = json.loads(read(live_file) or "{}")
    if args.live:
        print("fetching prod metrics…", file=sys.stderr)
        fetched = live_counts(canister_ids())
        if fetched:
            counts = {"live": {**counts.get("live", {}), **fetched}, "live_as_of": datetime.now(timezone.utc).strftime("%Y-%m-%d")}
            if out == (OUT_DIR / "index.html").resolve():
                live_file.write_text(json.dumps(counts, indent=1) + "\n", encoding="utf-8")
        else:
            print("no prod metrics reachable; keeping the counts in live.json", file=sys.stderr)
    data["live"] = counts.get("live", {})
    data["live_as_of"] = counts.get("live_as_of")

    template = read(OUT_DIR / "template.html")
    payload = json.dumps(data, ensure_ascii=False).replace("</", "<\\/")
    page = template.replace("/*__DATA__*/null", payload)
    # template.html is a page fragment (head elements, then the app markup); index.html wraps it
    # in a full document so it can be served from anywhere
    head, body = page.split('<div id="app">', 1)
    html = (
        '<!doctype html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n'
        '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n'
        + head + '</head>\n<body>\n<div id="app">' + body + '\n</body>\n</html>\n'
    )
    out.write_text(html, encoding="utf-8")
    print(f"wrote {out} ({len(html) // 1024} KB)", file=sys.stderr)

    total = sum(len(c["endpoints"]) for c in data["canisters"].values())
    print(f"{len(data['canisters'])} canisters, {total} endpoints", file=sys.stderr)


if __name__ == "__main__":
    main()
