import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type Handler = (...args: unknown[]) => void;

class FakeConn {
    open = true;
    sent: unknown[] = [];
    handlers = new Map<string, Handler>();
    constructor(public peer: string) {}
    on(evt: string, h: Handler) {
        this.handlers.set(evt, h);
    }
    send(m: unknown) {
        this.sent.push(m);
    }
    emit(evt: string, ...args: unknown[]) {
        this.handlers.get(evt)?.(...args);
    }
}

const peers = vi.hoisted(() => ({ instances: [] as FakePeer[] }));

class FakePeer {
    destroyed = false;
    disconnected = false;
    handlers = new Map<string, Handler>();
    connections: FakeConn[] = [];
    constructor(
        public id: string,
        public options: unknown,
    ) {
        peers.instances.push(this);
    }
    on(evt: string, h: Handler) {
        this.handlers.set(evt, h);
    }
    connect(id: string) {
        const c = new FakeConn(id);
        this.connections.push(c);
        return c;
    }
    emit(evt: string, ...args: unknown[]) {
        this.handlers.get(evt)?.(...args);
    }
}

vi.mock("peerjs", () => ({ default: FakePeer }));

const iceServers = [{ urls: "turn:example" }];

describe("RtcConnectionsManager", () => {
    beforeEach(() => {
        peers.instances.length = 0;
        vi.stubGlobal(
            "fetch",
            vi.fn(() => Promise.resolve({ json: () => Promise.resolve(iceServers) })),
        );
    });

    afterEach(() => {
        vi.unstubAllGlobals();
    });

    async function setup() {
        vi.resetModules();
        const { RtcConnectionsManager } = await import("./rtcConnectionsManager");
        const mgr = new RtcConnectionsManager();
        const initPromise = mgr.init("me", "api-key");
        await vi.waitFor(() => expect(peers.instances.length).toBe(1));
        const peer = peers.instances[0];
        peer.emit("open", peer.id);
        await initPromise;
        return { mgr, peer };
    }

    it("creates one peer with fetched ice servers and a prefixed id", async () => {
        const { peer } = await setup();
        expect(fetch).toHaveBeenCalledWith(
            "https://openchat.metered.live/api/v1/turn/credentials?apiKey=api-key",
        );
        expect(peer.id).toBe("d_me");
        expect(peer.options).toEqual({ config: { iceServers } });
    });

    it("connects directly only when the TURN service refuses the key", async () => {
        vi.stubGlobal(
            "fetch",
            vi.fn(() =>
                Promise.resolve({ json: () => Promise.resolve({ error: "Invalid API Key" }) }),
            ),
        );
        const { peer } = await setup();
        expect(peer.options).toEqual({ config: { iceServers: [] } });
    });

    it("connects directly only when the TURN service can't be reached", async () => {
        vi.stubGlobal(
            "fetch",
            vi.fn(() => Promise.reject(new Error("offline"))),
        );
        const { peer } = await setup();
        expect(peer.options).toEqual({ config: { iceServers: [] } });
    });

    it("asks for no TURN credentials without a key", async () => {
        vi.resetModules();
        const { RtcConnectionsManager } = await import("./rtcConnectionsManager");
        const initPromise = new RtcConnectionsManager().init("me", "");
        await vi.waitFor(() => expect(peers.instances.length).toBe(1));
        const peer = peers.instances[0];
        peer.emit("open", peer.id);
        await initPromise;
        expect(fetch).not.toHaveBeenCalled();
        expect(peer.options).toEqual({ config: { iceServers: [] } });
    });

    it("makes one peer for inits made while it's on its way", async () => {
        vi.resetModules();
        const { RtcConnectionsManager } = await import("./rtcConnectionsManager");
        const mgr = new RtcConnectionsManager();
        const first = mgr.init("me", "api-key");
        const second = mgr.init("me", "api-key");
        await vi.waitFor(() => expect(peers.instances.length).toBe(1));
        const peer = peers.instances[0];
        peer.emit("open", peer.id);
        expect(await first).toBe(peer);
        expect(await second).toBe(peer);
        expect(peers.instances.length).toBe(1);
        expect(fetch).toHaveBeenCalledTimes(1);
    });

    it("makes an init that comes once the peer is made, before it opens, wait for it", async () => {
        vi.resetModules();
        const { RtcConnectionsManager } = await import("./rtcConnectionsManager");
        const mgr = new RtcConnectionsManager();
        const first = mgr.init("me", "api-key");
        await vi.waitFor(() => expect(peers.instances.length).toBe(1));
        const peer = peers.instances[0];
        let opened = false;
        const second = mgr.init("me", "api-key").then((p) => {
            opened = true;
            return p;
        });
        await Promise.resolve();
        expect(opened).toBe(false);
        peer.emit("open", peer.id);
        expect(await first).toBe(peer);
        expect(await second).toBe(peer);
        expect(peers.instances.length).toBe(1);
    });

    it("makes a new peer on the next init when one closes before it opens", async () => {
        vi.resetModules();
        const { RtcConnectionsManager } = await import("./rtcConnectionsManager");
        const mgr = new RtcConnectionsManager();
        const first = mgr.init("me", "api-key");
        await vi.waitFor(() => expect(peers.instances.length).toBe(1));
        peers.instances[0].emit("close");
        await expect(first).rejects.toThrow();

        const second = mgr.init("me", "api-key");
        await vi.waitFor(() => expect(peers.instances.length).toBe(2));
        const peer = peers.instances[1];
        peer.emit("open", peer.id);
        expect(await second).toBe(peer);
    });

    it("reuses the existing peer on subsequent init", async () => {
        const { mgr } = await setup();
        await mgr.init("me", "api-key");
        expect(peers.instances.length).toBe(1);
    });

    it("connects to both device ids of a user and sends only on open connections", async () => {
        const { mgr, peer } = await setup();
        mgr.create("me", "them", "api-key");
        await vi.waitFor(() => expect(peer.connections.length).toBe(2));
        expect(peer.connections.map((c) => c.peer)).toEqual(["m_them", "d_them"]);

        peer.connections[0].emit("open");
        peer.connections[1].open = false;
        peer.connections[1].emit("open");

        const msg = { kind: "remote_user_typing" } as never;
        mgr.sendMessage(["them"], msg);
        expect(peer.connections[0].sent).toEqual([msg]);
        expect(peer.connections[1].sent).toEqual([]);

        mgr.disconnectFromUser("them");
        mgr.sendMessage(["them"], msg);
        expect(peer.connections[0].sent).toEqual([msg]);
    });

    it("delivers incoming data to the subscriber", async () => {
        const { mgr, peer } = await setup();
        const received: unknown[] = [];
        mgr.subscribe((m) => received.push(m));
        const incoming = new FakeConn("m_other");
        peer.emit("connection", incoming);
        incoming.emit("data", { hello: 1 });
        expect(received).toEqual([{ hello: 1 }]);
    });
});
