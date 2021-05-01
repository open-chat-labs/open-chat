import { Actor, Agent, HttpAgent, Identity, Principal } from "@dfinity/agent";
import { idlFactory as chats_idl } from "dfx-generated/chats";
import { idlFactory as p2p_idl } from "dfx-generated/p2p";
import { idlFactory as user_mgmt_idl } from "dfx-generated/user_mgmt";
import { Option } from "../domain/model/common";
import ChatsService from "./chats/chats";
import P2pService from "./p2p/p2p";
import UserMgmtService from "./userMgmt/user_mgmt";
import { getCanisterIds } from "../utils/canisterFunctions";

export default class CanisterClientFactory {
    private readonly _chatsActor: ChatsService
    private readonly _p2pActor: P2pService
    private readonly _userMgmtActor: UserMgmtService

    constructor(userId: Identity) {
        const agent = new HttpAgent({
            host: "",
            identity: userId,
        });

        const canisterIds = getCanisterIds();

        this._chatsActor = this.createActor<ChatsService>(agent, canisterIds.chats, chats_idl);
        this._p2pActor = this.createActor<P2pService>(agent, canisterIds.p2p, p2p_idl);
        this._userMgmtActor = this.createActor<UserMgmtService>(agent, canisterIds.userMgmt, user_mgmt_idl);
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

    private createActor<T>(agent: Agent, canisterId: Principal, factory: any) : T {
        return Actor.createActor<T>(factory, {
            agent,
            canisterId,
        });
    }
}