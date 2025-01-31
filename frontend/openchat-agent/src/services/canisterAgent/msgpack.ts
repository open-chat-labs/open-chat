import {
    bufFromBufLike,
    Certificate,
    HttpAgent,
    type Identity,
    lookupResultToBuffer,
    polling,
    QueryCallRejectedError,
    UpdateCallRejectedError,
} from "@dfinity/agent";
import { Principal } from "@dfinity/principal";
import { toCanisterResponseError } from "../error";
import { type Options, Packr } from "msgpackr";
import type { Static, TSchema } from "@sinclair/typebox";
import { AssertError, Value } from "@sinclair/typebox/value";
import { CanisterAgent } from "./base";

const Packer = new Packr({
    useRecords: false,
    skipValues: [undefined],
    largeBigIntToString: true,
} as unknown as Options);

export abstract class MsgpackCanisterAgent extends CanisterAgent {
    constructor(
        identity: Identity,
        agent: HttpAgent,
        canisterId: string,
    ) {
        super(identity, agent, canisterId);
    }

    protected async executeMsgpackQuery<In extends TSchema, Resp extends TSchema, Out>(
        methodName: string,
        args: Static<In>,
        mapper: (from: Static<Resp>) => Out | Promise<Out>,
        requestValidator: In,
        responseValidator: Resp,
    ): Promise<Out> {
        const payload = MsgpackCanisterAgent.prepareMsgpackArgs(args, requestValidator);

        return await this.handleQueryResponse(
            () =>
                this.agent.query(this.canisterId, {
                    methodName: methodName + "_msgpack",
                    arg: payload,
                }),
            (resp) => {
                if (resp.status === "replied") {
                    return Promise.resolve(
                        MsgpackCanisterAgent.processMsgpackResponse(
                            resp.reply.arg,
                            mapper,
                            responseValidator,
                        ),
                    );
                } else {
                    throw new QueryCallRejectedError(
                        Principal.fromText(this.canisterId),
                        methodName,
                        resp,
                    );
                }
            },
            args,
        );
    }

    protected async executeMsgpackUpdate<In extends TSchema, Resp extends TSchema, Out>(
        methodName: string,
        args: Static<In>,
        mapper: (from: Static<Resp>) => Out | Promise<Out>,
        requestValidator: In,
        responseValidator: Resp,
        onRequestAccepted?: () => void,
    ): Promise<Out> {
        const payload = MsgpackCanisterAgent.prepareMsgpackArgs(args, requestValidator);

        try {
            const { requestId, response } = await this.sendRequestToCanister(() =>
                this.agent.call(this.canisterId, {
                    methodName: methodName + "_msgpack",
                    arg: payload,
                    callSync: onRequestAccepted === undefined,
                }),
            );
            const canisterId = Principal.fromText(this.canisterId);

            if (response.ok && response.body?.certificate) {
                const certTime = this.agent.replicaTime;
                const certificate = await Certificate.create({
                    certificate: bufFromBufLike(response.body?.certificate),
                    rootKey: this.agent.rootKey,
                    canisterId: Principal.from(canisterId),
                    certTime,
                });
                const path = [new TextEncoder().encode("request_status"), requestId];
                const status = new TextDecoder().decode(
                    lookupResultToBuffer(certificate.lookup([...path, "status"])),
                );

                switch (status) {
                    case "replied": {
                        const reply = lookupResultToBuffer(certificate.lookup([...path, "reply"]));
                        if (reply) {
                            return Promise.resolve(
                                MsgpackCanisterAgent.processMsgpackResponse(
                                    reply,
                                    mapper,
                                    responseValidator,
                                ),
                            );
                        }
                        break;
                    }
                    case "rejected":
                        throw new UpdateCallRejectedError(
                            canisterId,
                            methodName,
                            requestId,
                            response,
                        );
                }
            }
            if (response.status === 202) {
                if (onRequestAccepted !== undefined) {
                    onRequestAccepted();
                }

                const { reply } = await this.sendRequestToCanister(() =>
                    polling.pollForResponse(
                        this.agent,
                        canisterId,
                        requestId,
                        polling.defaultStrategy(),
                    ),
                );
                return Promise.resolve(
                    MsgpackCanisterAgent.processMsgpackResponse(reply, mapper, responseValidator),
                );
            } else {
                throw new UpdateCallRejectedError(
                    canisterId,
                    methodName,
                    requestId,
                    response,
                );
            }
        } catch (err) {
            console.log(err, args);
            throw toCanisterResponseError(err as Error, this.identity);
        }
    }

    private static validate<T extends TSchema>(value: unknown, validator: T): Static<T> {
        return Value.Parse(validator, value);
    }

    private static prepareMsgpackArgs<T extends TSchema>(
        value: Static<T>,
        validator: T,
    ): ArrayBuffer {
        const validated = MsgpackCanisterAgent.validate(value, validator);
        return Packer.pack(validated);
    }

    private static processMsgpackResponse<Resp extends TSchema, Out>(
        responseBytes: ArrayBuffer,
        mapper: (from: Static<Resp>) => Out,
        validator: Resp,
    ): Out {
        const response = Packer.unpack(new Uint8Array(responseBytes));
        try {
            const validated = MsgpackCanisterAgent.validate(response, validator);
            return mapper(validated);
        } catch (err) {
            console.error(
                "Validation failed for response: ",
                response,
                err instanceof AssertError ? err.error : undefined,
            );
            throw err;
        }
    }
}
