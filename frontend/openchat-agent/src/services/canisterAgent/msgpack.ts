import {
    bufFromBufLike,
    Certificate,
    HttpAgent,
    type Identity,
    lookupResultToBuffer,
    polling,
    QueryCallRejectedError,
    ReplicaRejectCode,
    UpdateCallRejectedError,
    type v3ResponseBody,
} from "@dfinity/agent";
import { Principal } from "@dfinity/principal";
import { toCanisterResponseError } from "../error";
import { type Options, Packr } from "msgpackr";
import type { Static, TSchema } from "@sinclair/typebox";
import { AssertError } from "@sinclair/typebox/value";
import { CanisterAgent } from "./base";
import { typeboxValidate } from "../../utils/typebox";

const Packer = new Packr({
    useRecords: false,
    skipValues: [null, undefined],
    largeBigIntToString: true,
} as unknown as Options);

export abstract class MsgpackCanisterAgent extends CanisterAgent {
    constructor(identity: Identity, agent: HttpAgent, canisterId: string, canisterName: string) {
        super(identity, agent, canisterId, canisterName);
    }

    protected async executeMsgpackQuery<In extends TSchema, Resp extends TSchema, Out>(
        methodName: string,
        args: Static<In>,
        mapper: (from: Static<Resp>) => Out | Promise<Out>,
        requestValidator: In,
        responseValidator: Resp,
    ): Promise<Out> {
        const start = performance.now();
        let isError = false;
        try {
            const payload = MsgpackCanisterAgent.prepareMsgpackArgs(args, requestValidator);

            return await this.executeQuery(
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
        } catch (err) {
            isError = true;
            throw err;
        } finally {
            this.writeTrace(methodName, false, performance.now() - start, isError);
        }
    }

    protected async executeMsgpackUpdate<In extends TSchema, Resp extends TSchema, Out>(
        methodName: string,
        args: Static<In>,
        mapper: (from: Static<Resp>) => Out | Promise<Out>,
        requestValidator: In,
        responseValidator: Resp,
        onRequestAccepted?: () => void,
    ): Promise<Out> {
        const start = performance.now();
        let isError = false;
        try {
            const payload = MsgpackCanisterAgent.prepareMsgpackArgs(args, requestValidator);

            const { requestId, response } = await this.agent.call(this.canisterId, {
                methodName: methodName + "_msgpack",
                arg: payload,
                callSync: onRequestAccepted === undefined,
            });
            const canisterId = Principal.fromText(this.canisterId);

            if (response.ok && (response.body as v3ResponseBody)?.certificate) {
                const cert = (response.body as v3ResponseBody).certificate;
                // const certTime = this.agent.replicaTime;
                const certificate = await Certificate.create({
                    certificate: bufFromBufLike(cert),
                    rootKey: this.agent.rootKey,
                    canisterId: Principal.from(canisterId),
                    blsVerify: undefined,
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
                    case "rejected": {
                        // Find rejection details in the certificate
                        const rejectCode = new Uint8Array(
                            lookupResultToBuffer(certificate.lookup([...path, "reject_code"]))!,
                        )[0];
                        const rejectMessage = new TextDecoder().decode(
                            lookupResultToBuffer(certificate.lookup([...path, "reject_message"]))!,
                        );
                        const error_code_buf = lookupResultToBuffer(
                            certificate.lookup([...path, "error_code"]),
                        );
                        const error_code = error_code_buf
                            ? new TextDecoder().decode(error_code_buf)
                            : undefined;
                        throw new UpdateCallRejectedError(
                            canisterId,
                            methodName,
                            requestId,
                            response,
                            rejectCode,
                            rejectMessage,
                            error_code,
                        );
                    }
                }
            }
            if (response.status === 202) {
                if (onRequestAccepted !== undefined) {
                    onRequestAccepted();
                }

                const { reply } = await polling.pollForResponse(
                    this.agent,
                    canisterId,
                    requestId,
                    polling.defaultStrategy(),
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
                    ReplicaRejectCode.CanisterReject,
                    "",
                );
            }
        } catch (err) {
            isError = true;
            console.log(err, args);
            throw toCanisterResponseError(err as Error, this.identity);
        } finally {
            this.writeTrace(methodName, true, performance.now() - start, isError);
        }
    }

    private static prepareMsgpackArgs<T extends TSchema>(
        value: unknown,
        validator: T,
    ): ArrayBuffer {
        const validated = typeboxValidate(value, validator);
        return Packer.pack(validated);
    }

    private static processMsgpackResponse<Resp extends TSchema, Out>(
        responseBytes: ArrayBuffer,
        mapper: (from: Static<Resp>) => Out,
        validator: Resp,
    ): Out {
        const response = Packer.unpack(new Uint8Array(responseBytes));
        try {
            const validated = typeboxValidate(response, validator);
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
