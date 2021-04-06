import { Actor, Agent, HttpAgent, Identity, Principal } from "@dfinity/agent";
import ChatsCanisterInterface from "ic:idl/chats";
import P2PCanisterInterface from "ic:idl/p2p";
import UserMgmtCanisterInterface from "ic:idl/user_mgmt";
import { InterfaceFactory } from "@dfinity/agent/src/idl";
import { ActorSubclass } from "@dfinity/agent/src/actor";
import { Option } from "../domain/model/common";
import ChatsService from "./chats/chats";
import P2pService from "./p2p/p2p";
import UserMgmtService from "./userMgmt/user_mgmt";

type CanisterIds = {
    chats: Principal,
    p2p: Principal,
    userMgmt: Principal
}

export default class CanisterClientFactory {
    private readonly _chatsActor: ChatsService
    private readonly _p2pActor: P2pService
    private readonly _userMgmtActor: UserMgmtService

    constructor(userId: Identity, canisterIds: CanisterIds) {
        const host = location.href.indexOf(".ic0.app") > 0
            ? "gw.dfinity.network"
            : "";

        const agent = new HttpAgent({
            host,
            identity: userId,
        });

        this._chatsActor = this.createActor<ChatsService>(agent, canisterIds.chats, ChatsCanisterInterface);
        this._p2pActor = this.createActor<P2pService>(agent, canisterIds.p2p, P2PCanisterInterface);
        this._userMgmtActor = this.createActor<UserMgmtService>(agent, canisterIds.userMgmt, UserMgmtCanisterInterface);
    }

    public get chatsClient() : ChatsService {
        return this._chatsActor;
    }

    public get p2pClient() : P2pService {
        return this._p2pActor;
    }

    public get userMgmtClient() : UserMgmtService {
        return this._userMgmtActor;
    }

    public static get current() : Option<CanisterClientFactory> {
        return (window as any).canisterClientFactory;
    }

    public static set current(value: Option<CanisterClientFactory>) {
        (window as any).canisterClientFactory = value;
    }

    private createActor<T>(agent: Agent, canisterId: Principal, factory: InterfaceFactory) : T {
        return Actor.createActor<T>(factory, {
            agent,
            canisterId
        });
    }
}