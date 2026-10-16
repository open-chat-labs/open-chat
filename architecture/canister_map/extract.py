#!/usr/bin/env python3
"""Builds the data behind architecture/canister_map/index.html from the backend source.

For every canister crate under backend/canisters it reads:
  - the endpoints: every #[query(...)] / #[update(...)] in impl/src, with its guard and which
    encodings (candid / msgpack / json) it accepts, plus the Args / Response types from api/src
  - the state: the fields of the `Data` struct in impl/src/lib.rs, with their comments
  - the Metrics struct, the timer job types, the background jobs and the stable memory regions
  - who it calls: every `<x>_canister_c2c_client::<method>` in impl/src, plus those made by the
    shared libraries it depends on (attributed "via <library>")
  - its init args, lifecycle hooks, latest released version and prod canister id

Run from the repo root:

    python3 architecture/canister_map/extract.py            # writes canister_map/index.html
    python3 architecture/canister_map/extract.py --live     # also refreshes live.json from prod metrics

index.html is produced by splicing the data into template.html, so the page stays a single file.
"""

import json
import os
import re
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
        "summary": "Holds a few thousand users each: their direct chats, chat list and wallet.",
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
        "summary": "One canister per group chat: members, messages and events.",
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
        "summary": "Push subscriptions, and the notification pushers' entry point.",
        "detail": "Holds each user's web push subscriptions and the principals of the off-chain notification "
        "pushers, and tells every LocalUserIndex about them so the pushers can read the notification "
        "queue held on each subnet.",
    },
    "storage_index": {
        "title": "StorageIndex",
        "zone": "storage",
        "cardinality": "single",
        "summary": "File storage index: per-user byte allowances and which bucket holds what.",
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
        "zone": "tokens",
        "cardinality": "single",
        "summary": "The list of tokens, nervous systems and subnets OpenChat knows about.",
        "detail": "Any user can propose adding a token; the Registry validates it against the ledger, "
        "charges the fee and lists it. It also tracks SNS nervous systems for the ProposalsBot, "
        "message filters, swap providers, and expands OpenChat onto a new subnet by creating that "
        "subnet's LocalUserIndex.",
    },
    "escrow": {
        "title": "Escrow",
        "zone": "tokens",
        "cardinality": "single",
        "summary": "Holds both sides of a peer-to-peer token swap until it completes.",
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
        "summary": "Collects analytics events and forwards them to the event store.",
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
    "market_maker": {
        "title": "MarketMaker",
        "zone": "governance",
        "cardinality": "single",
        "summary": "Keeps CHAT markets liquid on ICDex.",
        "detail": "Places and cancels bid and ask orders around the mid price on configured exchanges "
        "within the limits set by proposal.",
    },
    "call_relay": {
        "title": "CallRelay",
        "zone": "platform",
        "cardinality": "ephemeral",
        "summary": "A tiny wasm installed on an old user canister to move its funds out.",
        "detail": "Written directly in WebAssembly text. When a migrated user's old canister still holds "
        "tokens, the LocalUserIndex installs this on it, relays ledger transfers as the canister, then "
        "uninstalls it.",
    },
    "cycles_refunder": {
        "title": "CyclesRefunder",
        "zone": "platform",
        "cardinality": "ephemeral",
        "summary": "A tiny wasm installed on an uninstalled canister to recover its cycles.",
        "detail": "Written directly in WebAssembly text. The LocalUserIndex installs it on the uninstalled "
        "canisters of deleted users, groups and communities; it sends their spare cycles to the "
        "CyclesDispenser and is then uninstalled.",
    },
}

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
    "icdex": ("ICDex", "Order book exchange"),
    "icpswap_swap_pool": ("ICPSwap", "Swap pools"),
    "taco_exchange": ("TACO", "Swap aggregator"),
    "management": ("IC management canister", "create_canister, install_code, ECDSA signing, HTTPS outcalls"),
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

ATTR_RE = re.compile(r"^\s*#\[(query|update|proposal)\s*(?:\(([^)]*)\))?\]\s*$")
FN_RE = re.compile(r"^\s*(?:pub(?:\([^)]*\))?\s+)?(?:async\s+)?fn\s+([a-zA-Z0-9_]+)")
C2C_RE = re.compile(r"\b([a-z_0-9]+)_canister_c2c_client::([a-z_0-9]+)\b")
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
                endpoints.append(dict(name=name, kind="update", guard=flags["guard"], candid=True, msgpack=False, json=False, composite=False, hidden=False, c2c=False, proposal=True, comment=comment, file=rel))
                endpoints.append(dict(name=name + "_validate", kind="query", guard=flags["guard"], candid=True, msgpack=False, json=False, composite=False, hidden=False, c2c=False, proposal=True, comment="Renders the proposal payload for voters; generated by #[proposal]", file=rel))
                continue
            endpoints.append(
                {
                    "name": name,
                    "kind": kind,
                    "guard": flags["guard"],
                    "candid": flags["candid"],
                    "msgpack": flags["msgpack"],
                    "json": flags["json"],
                    "composite": flags["composite"],
                    "hidden": flags["hidden"],
                    "c2c": name.startswith("c2c_"),
                    "proposal": False,
                    "comment": comment,
                    "file": rel,
                }
            )
    endpoints.sort(key=lambda e: (e["kind"] != "query", e["name"]))
    return endpoints


def strip_api_source(text):
    """Keeps the Args / Response definitions of an api module, dropping imports and derives."""
    kept = []
    for line in text.splitlines():
        s = line.strip()
        if s.startswith("use ") or s.startswith("#[derive") or s.startswith("#[ts_export") or s.startswith("#[serde(") and False:
            continue
        if s.startswith("#[cfg(") or s.startswith("mod tests") or s.startswith("#[test]"):
            break
        kept.append(line.rstrip())
    out = "\n".join(kept).strip("\n")
    out = re.sub(r"\n{3,}", "\n\n", out)
    return out


def extract_api_types(api_src):
    """Maps endpoint name -> trimmed source of its Args / Response module."""
    types = {}
    for sub in ("queries", "updates"):
        d = api_src / sub
        if not d.exists():
            continue
        for path in sorted(d.glob("*.rs")):
            if path.name == "mod.rs":
                continue
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
    lines = text[m.start():].splitlines()
    comment = []
    for idx, line in enumerate(lines):
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
    for sub in ("jobs",):
        d = impl_src / sub
        if not d.exists():
            continue
        for path in sorted(d.glob("*.rs")):
            if path.name == "mod.rs":
                continue
            text = read(path)
            lines = text.splitlines()
            comment = []
            for line in lines:
                s = line.strip()
                if s.startswith("//"):
                    comment.append(s.lstrip("/").strip())
                elif s.startswith("use ") or s == "":
                    if comment:
                        break
                    continue
                else:
                    break
            interval = None
            im = re.search(r"(?:Duration::from_(?:secs|millis)\(([^)]+)\)|\b([A-Z_]+_IN_MS)\b)", text)
            if im:
                interval = im.group(1) or im.group(2)
            jobs.append(
                {
                    "name": path.stem,
                    "comment": " ".join(comment),
                    "interval_hint": interval,
                    "file": str(path.relative_to(ROOT)),
                }
            )
    regular = impl_src / "regular_jobs.rs"
    if regular.exists():
        for m in re.finditer(r"RegularJob::new\(\s*\"([^\"]+)\"\s*,\s*([a-z_0-9:]+)\s*,\s*([^)]+)\)", read(regular)):
            jobs.append({"name": m.group(1), "comment": "Regular job run on activity: " + m.group(2), "interval_hint": m.group(3).strip(), "file": str(regular.relative_to(ROOT))})
    return jobs


def extract_memory(impl_src):
    text = read(impl_src / "memory.rs")
    regions = []
    for m in re.finditer(r"const ([A-Z_0-9]+): MemoryId = MemoryId::new\((\d+)\);", text):
        regions.append({"name": m.group(1), "id": int(m.group(2))})
    return regions


def extract_guards(impl_src):
    text = read(impl_src / "guards.rs")
    guards = {}
    for m in re.finditer(r"pub fn ([a-z_0-9]+)\(\)[^{]*\{(.*?)\n\}", text, re.S):
        body = m.group(2)
        em = re.search(r"Err\(\"([^\"]+)\"", body)
        label = None
        if em:
            label = em.group(1)
            label = re.sub(r"^Caller is not (the |a |an |one of )?", "", label).rstrip(".")
        guards[m.group(1)] = label or m.group(1)
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
    hooks = []
    if d.exists():
        for path in sorted(d.glob("*.rs")):
            if path.name != "mod.rs":
                hooks.append(path.stem)
    if (impl_src / "lifecycle" / "inspect_message.rs").exists() and "inspect_message" not in hooks:
        hooks.append("inspect_message")
    return hooks


def extract_version(canister_dir):
    text = read(canister_dir / "CHANGELOG.md")
    m = VERSION_RE.search(text)
    if not m:
        return None
    return {"version": m.group(1), "url": m.group(2), "date": m.group(3)}


def extract_c2c_calls(src_dir):
    calls = {}
    for path in rust_files(src_dir):
        for m in C2C_RE.finditer(read(path)):
            target, method = m.group(1), m.group(2)
            if method[0].isupper() or method in ("Args", "Response"):
                continue
            calls.setdefault(target, set()).add(method)
    return calls


def cargo_deps(cargo_toml):
    text = read(cargo_toml)
    deps = set()
    in_deps = False
    for line in text.splitlines():
        s = line.strip()
        if s.startswith("["):
            in_deps = s in ("[dependencies]",)
            continue
        if in_deps:
            m = re.match(r"([A-Za-z0-9_\-]+)\s*=", s)
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
        counts["group"] = [
            ("public groups", m.get("public_groups")),
            ("private groups", m.get("private_groups")),
        ]
        counts["community"] = [
            ("public communities", m.get("public_communities")),
            ("private communities", m.get("private_communities")),
        ]
    m = fetch_metrics(ids["storage_index"])
    if m:
        counts["storage_index"] = [
            ("files", m.get("file_count")),
            ("GB stored", round((m.get("total_file_bytes") or 0) / 1e9)),
        ]
        counts["storage_bucket"] = [("active buckets", len([b for b in m.get("active_buckets", [])]))]
    m = fetch_metrics(ids["notifications_index"])
    if m:
        counts["notifications_index"] = [("users with subscriptions", m.get("users")), ("subscriptions", m.get("subscriptions"))]
    m = fetch_metrics(ids["identity"])
    if m:
        counts["identity"] = [("identities", m.get("user_principals")), ("auth principals", m.get("auth_principals"))]
    m = fetch_metrics(ids["online_users"])
    if m:
        counts["online_users"] = [("mark_as_online calls", m.get("mark_as_online_count"))]
    return {k: [[label, v] for (label, v) in pairs if v is not None] for k, pairs in counts.items()}


def library_calls():
    """c2c calls made by shared libraries, keyed by library crate name."""
    out = {}
    for lib in sorted(LIBRARIES.iterdir()):
        src = lib / "src"
        if not src.exists():
            continue
        calls = extract_c2c_calls(src)
        if calls:
            out[lib.name] = calls
    return out


def build():
    ids = canister_ids()
    lib_calls = library_calls()
    canisters = {}

    for d in sorted(CANISTERS.iterdir()):
        name = d.name
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
            "offchain": [],
            "libraries": [],
            "loc": 0,
            "path": str(d.relative_to(ROOT)),
        }

        if impl_src.exists():
            lib_text = read(impl_src / "lib.rs")
            entry["endpoints"] = extract_endpoints(impl_src)
            for pm in re.finditer(r"proposal_validation!\(\s*([a-z_0-9]+)\s*,\s*([a-z_0-9]+)", lib_text):
                entry["endpoints"].append(dict(name=f"{pm.group(1)}_{pm.group(2)}_validate", kind="query", guard=None, candid=True, msgpack=False, json=False, composite=False, hidden=False, c2c=False, proposal=True, comment=f"Renders a {pm.group(1)} {pm.group(2)} proposal payload as text for voters", file=str((impl_src / "lib.rs").relative_to(ROOT))))
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

            deps = cargo_deps(d / "impl" / "Cargo.toml")
            calls = {t: {"methods": sorted(ms), "via": None} for t, ms in extract_c2c_calls(impl_src).items()}
            for lib, lcalls in lib_calls.items():
                if lib in deps:
                    entry["libraries"].append(lib)
                    for t, ms in lcalls.items():
                        if t in calls:
                            existing = set(calls[t]["methods"])
                            new = sorted(ms - existing)
                            if new:
                                calls[t]["methods"] = sorted(existing | ms)
                                calls[t]["via"] = (calls[t]["via"] or [])
                                if isinstance(calls[t]["via"], list):
                                    calls[t]["via"].append(lib)
                        else:
                            calls[t] = {"methods": sorted(ms), "via": [lib]}
            if "ic-cdk-management-canister" in deps:
                calls["management"] = {"methods": ["create_canister", "install_code", "canister_status", "…"], "via": None}
            if "event_store_producer" in deps and name != "event_relay":
                calls.setdefault("event_relay", {"methods": ["push_events"], "via": ["event_store_producer"]})
            if name == "event_relay":
                calls["event_store"] = {"methods": ["push_events"], "via": None}
            if name == "sign_in_with_email":
                calls["management"] = {"methods": ["http_request (email provider)", "sign_with_ecdsa"], "via": None}

            internal = {t: c for t, c in calls.items() if t in DESCRIPTIONS}
            external = {t: c for t, c in calls.items() if t in EXTERNALS}
            unknown = [t for t in calls if t not in DESCRIPTIONS and t not in EXTERNALS]
            if unknown:
                print(f"  {name}: unclassified call targets {unknown}", file=sys.stderr)
            entry["calls"] = internal
            entry["externals"] = external

            actors = set()
            for e in entry["endpoints"]:
                g = e["guard"] or ""
                for frag, (label, _) in OFFCHAIN.items():
                    if frag in g:
                        actors.add(label)
            entry["offchain"] = sorted(actors)
        else:
            # The two wat canisters
            readme = read(d / "README.md")
            if name == "call_relay":
                entry["endpoints"] = [{"name": "relay", "kind": "update", "guard": "controller", "candid": False, "msgpack": False, "json": False, "composite": False, "hidden": False, "c2c": True, "comment": "Raw args: callee | method | payload. Calls the method as this canister and relays the reply.", "file": "backend/canisters/call_relay/call_relay.wat"}]
                entry["externals"] = {"icrc_ledger": {"methods": ["icrc1_transfer (relayed)"], "via": None}}
            if name == "cycles_refunder":
                entry["endpoints"] = [{"name": "refund", "kind": "update", "guard": None, "candid": True, "msgpack": False, "json": False, "composite": False, "hidden": False, "c2c": False, "comment": "Sends all spare cycles to the CyclesDispenser and returns how many were sent.", "file": "backend/canisters/cycles_refunder/cycles_refunder.wat"}]
                entry["calls"] = {"cycles_dispenser": {"methods": ["deposit_cycles"], "via": None}}
            entry["readme"] = readme
            entry["loc"] = len(read(d / f"{name}.wat").splitlines())

        # Which endpoints the web app calls directly (ts_export in api/src/main.rs)
        main_rs = read(api_src / "main.rs")
        ts = set(re.findall(r"generate_ts_method!\(\s*[a-z_]+\s*,\s*([a-z_0-9]+)", main_rs))
        candid = set(re.findall(r"generate_candid_method!\(\s*[a-z_]+\s*,\s*([a-z_0-9]+)", main_rs))
        for e in entry["endpoints"]:
            base = re.sub(r"_(v2|v3|msgpack|c2c|validate)$", "", e["name"])
            e["frontend"] = e["name"] in ts or base in ts
            e["in_did"] = e["candid"] or e["name"] in candid or base in candid
            e["api"] = e["name"] if e["name"] in entry["api_types"] else (base if base in entry["api_types"] else None)

        canisters[name] = entry

    # Incoming calls, derived from everyone's outgoing ones
    for name, entry in canisters.items():
        entry["called_by"] = {}
    for name, entry in canisters.items():
        for target, c in entry["calls"].items():
            if target in canisters:
                canisters[target]["called_by"][name] = c

    return {
        "generated": datetime.now(timezone.utc).strftime("%Y-%m-%d"),
        "commit": os.popen("git rev-parse --short HEAD").read().strip(),
        "zones": ZONES,
        "externals": {k: {"title": v[0], "detail": v[1]} for k, v in EXTERNALS.items()},
        "offchain": {v[0]: v[1] for v in OFFCHAIN.values()},
        "canisters": canisters,
    }


def main():
    live = "--live" in sys.argv
    data = build()
    # The prod counts are kept in live.json between runs, so a plain run doesn't touch the network
    live_file = OUT_DIR / "live.json"
    if live:
        print("fetching prod metrics…", file=sys.stderr)
        counts = {"live": live_counts(canister_ids()), "live_as_of": datetime.now(timezone.utc).strftime("%Y-%m-%d")}
        live_file.write_text(json.dumps(counts, indent=1) + "\n", encoding="utf-8")
    else:
        counts = json.loads(read(live_file) or "{}")
    data["live"] = counts.get("live", {})
    data["live_as_of"] = counts.get("live_as_of")

    template = read(OUT_DIR / "template.html")
    if template:
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
        (OUT_DIR / "index.html").write_text(html, encoding="utf-8")
        print(f"wrote index.html ({len(html) // 1024} KB)", file=sys.stderr)

    total = sum(len(c["endpoints"]) for c in data["canisters"].values())
    print(f"{len(data['canisters'])} canisters, {total} endpoints", file=sys.stderr)


if __name__ == "__main__":
    main()
