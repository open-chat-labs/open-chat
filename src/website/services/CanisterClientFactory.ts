import { Actor, Agent, HttpAgent, Identity, Principal } from "@dfinity/agent";
import ChatsCanisterInterface from "ic:idl/chats";
import P2PCanisterInterface from "ic:idl/p2p";
import UserMgmtCanisterInterface from "ic:idl/user_mgmt";
import { InterfaceFactory } from "@dfinity/agent/src/idl";
import { ActorSubclass } from "@dfinity/agent/src/actor";
import { Option } from "../domain/model/common";

type CanisterIds = {
    chats: Principal,
    p2p: Principal,
    userMgmt: Principal
}

export default class CanisterClientFactory {
    private readonly _chatsActor: ActorSubclass
    private readonly _p2pActor: ActorSubclass
    private readonly _userMgmtActor: ActorSubclass

    constructor(userId: Identity, canisterIds: CanisterIds) {
        const agent = new HttpAgent({
            host: "",
            identity: userId,
        });

        this._chatsActor = this.createActor(agent, canisterIds.chats, ChatsCanisterInterface);
        this._p2pActor = this.createActor(agent, canisterIds.p2p, P2PCanisterInterface);
        this._userMgmtActor = this.createActor(agent, canisterIds.userMgmt, UserMgmtCanisterInterface);
    }

    public get chatsClient() : any {
        return this._chatsActor;
    }

    public get p2pClient() : any {
        return this._p2pActor;
    }

    public get userMgmtClient() : any {
        return this._userMgmtActor;
    }

    public static get current() : Option<CanisterClientFactory> {
        return (window as any).canisterClientFactory;
    }

    public static set current(value: Option<CanisterClientFactory>) {
        (window as any).canisterClientFactory = value;
    }

    private createActor(agent: Agent, canisterId: Principal, factory: InterfaceFactory) {
        return Actor.createActor(factory, {
            agent,
            canisterId
        }) as ActorSubclass;
    }
}