import {Account} from "near-api-js";
import {logger} from "./logger";
import {
    BountyCompletedEvent,
    BountyCreatedEvent,
    BountyStatuses,
    ClientConfig,
    ClientExecutionResult,
    ClientNode,
    CoordinatorContract,
    NodeConfig,
    NodeResponseStatuses,
    PayoutStrategies
} from "./types";
import WebSocket from "ws";
import shell from "shelljs";
import {readConfigFromEnv} from "./config"
import {emitBounty, getAccount, getBounty, getCoordinatorContract, MAX_GAS, publishEventToWebsocketRelay} from "./util";
import {Execution} from "./execution";
import {BountyRejectionError, ExecutionError, PostExecutionError, PreflightError, SetupError} from "./errors";
import {Database} from "./database";
import {NEAR} from "near-units";

// @ts-ignore: Unreachable code error                              <-- BigInt does not have `toJSON` method
BigInt.prototype.toJSON = function (): string {
    return this.toString();
};

//Below should match what's in the contract
const MIN_NODE_DEPOSIT = NEAR.parse("1N")

//Transient storage for bounty executions
export const database = new Database();

//Global config items
class ExecutionClient {
    private websocketClient: WebSocket
    public nodeConfig: NodeConfig = {
        absoluteTimeout: 0,
        allowGpu: false,
        allowNetwork: true,
    };

    constructor(public account: Account,
                public coordinatorContract: CoordinatorContract,
                public config: ClientConfig,
    ) {
        this.websocketClient = new WebSocket(this.config.websocketUrl);
    }

    async initialize() {
        logger.info(`Initializing execution client for node ${this.config.nodeId}`);
        let node: ClientNode;
        try {
            node = await this.coordinatorContract.get_node(
                {node_id: this.config.nodeId}
            );
            await this.validateNode(node)
        } catch (e) {
            logger.error(`Could not get node ${this.config.nodeId} from coordinator contract ${this.config.coordinatorContractId}. Attempting to create.`);
            node = await this.attemptCreateNode();
            await this.validateNode(node)
        }
        this.nodeConfig = {
            absoluteTimeout: node.absolute_timeout,
            allowNetwork: node.allow_network,
            allowGpu: node.allow_gpu,
        };
        this.addWebsocketListeners()
    }

    async attemptCreateNode(): Promise<ClientNode> {
        const balance = await this.account.getAccountBalance()
        if (BigInt(balance.available) > BigInt(MIN_NODE_DEPOSIT.toString())) {
            logger.info(`Node ${this.config.nodeId} has enough balance to register. Registering now.`);
            console.log(this.coordinatorContract)
            await this.coordinatorContract.register_node({
                name: this.config.nodeName,
                absolute_timeout: 60000,
                allow_gpu: false,
                allow_network: true,
            }, MAX_GAS, NEAR.parse("1N").toString())
            return this.coordinatorContract.get_node({node_id: this.config.nodeId})
        } else {
            logger.error(`Node ${this.config.nodeId} is not registered with the coordinator contract (${this.config.coordinatorContractId}) and can't afford the deposit to register`);
            process.exit(1);
            throw new ExecutionError("Node is not registered and can't afford the deposit to register")
        }
    }


    // Checks if the node has all the required software installed
    async validateNode(node?: ClientNode) {
        logger.info("Fetching node info from coordinator contract");

        //TODO Check if account is owner of the node
        logger.info(`Node ${this.config.nodeId} is registered with the following properties: ${JSON.stringify(node)}`);
        if (!node) {
            logger.info(`Node ${this.config.nodeId} is not registered with the coordinator contract. Registering now.`);
            //TODO Consider registering the node here

        }

        const missingSoftware = [];
        shell.which("docker") || missingSoftware.push("docker is not installed");
        shell.which("git") || missingSoftware.push("git is not installed");
        shell.which("curl") || missingSoftware.push("curl is not installed");
        shell.which("wget") || missingSoftware.push("wget is not installed");
        shell.which("tar") || missingSoftware.push("tar is not installed");
        shell.which("unzip") || missingSoftware.push("unzip is not installed");
        if (missingSoftware.length > 0) {
            logger.error(`Could not start node, missing the following software: ${missingSoftware.join(", ")}`);
            process.exit(1);
        }
        return node
    }

    async publishAnswer(bountyId: string, result: ClientExecutionResult) {
        logger.debug(`Attempting to publish answer for bounty ${bountyId} to coordinator contract with res: `, result);
        //Should always check should_post_answer first, since it's a view function and publish_answer is not
        logger.debug(`Checking if we should post answer for bounty ${bountyId}`);
        let execution = database.get(bountyId);
        execution.updateContext({phase: "Posting answer to chain"})

        const shouldPostAnswer = await this.coordinatorContract.should_post_answer({
                bounty_id: bountyId,
                node_id: this.config.nodeId
            }
        )
        logger.debug(`Should post answer for bounty ${bountyId}: ${shouldPostAnswer}`);
        execution.updateContext({shouldPostAnswer})
        if (shouldPostAnswer) {
            logger.info(`Publishing answer for bounty ${bountyId}`);
            const payload = {
                bounty_id: bountyId,
                node_id: this.config.nodeId,
                answer: result.result,
                message: result.message,
                status: result.errorType ? NodeResponseStatuses.FAILURE : NodeResponseStatuses.SUCCESS
            }
            logger.debug(`Publishing answer for bounty ${bountyId} with payload: `, payload);
            const res = await this.coordinatorContract.post_answer(payload)
            logger.info(`Successfully published answer for bounty ${bountyId} with result: `, res);
            execution.updateContext({phase: "Complete"})
        } else {
            execution.updateContext({phase: "Skipped, bounty already completed"})
            logger.info(`Not publishing answer for bounty ${bountyId} because should_post_answer returned false`);
        }

    }

    async rejectBounty(bountyId: string, result: ClientExecutionResult) {
        logger.info(`Rejecting bounty ${bountyId} for ${result.message}`);
        await this.coordinatorContract.reject_bounty({
            bounty_id: bountyId,
            node_id: this.config.nodeId,
            message: result.message || ""
        })
        logger.debug(`Successfully rejected bounty ${bountyId}`);
    }

    private addWebsocketListeners() {
        this.websocketClient = new WebSocket(this.config.websocketUrl);
        this.websocketClient.onopen = () => {
            logger.info(`Listening for bounties on ${this.config.websocketUrl}`);
            this.websocketClient.send(JSON.stringify({
                "filter": [{
                    "event": {
                        "event": "bounty_created"
                    }
                }],
                // "fetch_past_events": true,
                "secret": "execution_client"
            }), () => {
                logger.info("Subscribed to bounty_created events")
            });
        }
        this.websocketClient.onerror = (err) => {
            logger.error(`Error connecting to websocket ${this.config.websocketUrl}, ${err}`);
            process.exit(1);
        }
        this.websocketClient.on('message', async (data) => {
            try {
                // logger.debug(data)
                const message = JSON.parse(data.toString())
                if (message.event) {

                    //Below is extremely noisy, make sure it's commented out in prod or increase to logger.trace
                    // logger.debug(`Received message: `, message);
                    const eventData = JSON.parse(message.event)
                    if (eventData.event === "bounty_created" || eventData.event === "bounty_retry") {
                        //This is cryptic, but both bounty_created and bounty_retry events have the same payload
                        //bounty_retry will only attempt against newly elected nodes, create will attempt against all elected nodes
                        const event = eventData as BountyCreatedEvent;
                        if(event.data.coordinator_id !== this.config.coordinatorContractId) {
                            logger.debug("Received bounty_created event from a different coordinator contract, ignoring");
                            return;
                        }
                        const bountyData = event.data;
                        const bountyId = bountyData.bounty_id;
                        logger.info(`Received ${eventData.event} event for ${bountyId}. Checking if we're elected...`);
                        if (bountyData.node_ids.includes(this.config.nodeId)) {
                            logger.info(`We're elected! Executing bounty ${bountyId}...`);
                            try {
                                const bounty = await getBounty(this.config, this.coordinatorContract, bountyId)
                                const execution = new Execution(this.config, this.nodeConfig, bounty)
                                database.insert(bountyId, execution)
                                const res = await execution.execute()
                                await Promise.race([
                                    this.publishAnswer(bountyId, res),
                                    new Promise((_, reject) => setTimeout(() => reject(new Error('Execution timed out')), this.nodeConfig.absoluteTimeout))
                                ])
                                logger.info(`Execution of bounty ${bountyId} completed with result: ${JSON.stringify(res)}`);
                                await this.emitBountyCompleteEvent(bountyId)
                            } catch (e: any) {
                                logger.error(`Execution of bounty ${bountyId} failed with error: ${e.message}`);
                                if (e instanceof SetupError
                                    || e instanceof PreflightError
                                    || e instanceof ExecutionError) {
                                    logger.info(`Publishing error`)
                                    await this.publishAnswer(bountyId, {
                                        result: "",
                                        message: e.message,
                                        errorType: e.constructor.name
                                    })
                                    await this.emitBountyCompleteEvent(bountyId)
                                }
                                if (e instanceof BountyRejectionError) {
                                    logger.info(`Rejecting bounty`)
                                    await this.rejectBounty(bountyId, {
                                        result: "",
                                        message: e.message,
                                        errorType: e.constructor.name
                                    })
                                }
                            }
                        }
                    }
                    if (eventData.event == "bounty_completed") {
                        logger.info(`Received bounty_completed event for ${eventData.data.bounty_id}`)
                        const event = eventData as BountyCompletedEvent;
                        const {data} = event
                        const {bounty_id, payout_node_ids} = data
                        if (payout_node_ids.includes(this.config.nodeId)) {
                            logger.info(`We're elected to receive payout for bounty ${bounty_id}!`)
                            await this.coordinatorContract.collect_reward({bounty_id, node_id: this.config.nodeId})
                            logger.info(`Successfully collected reward for bounty ${bounty_id}`)
                        }
                    }
                }
            } catch (e) {
                e instanceof PostExecutionError
                    ? logger.error(`Error while posting execution result: ${e.message}`)
                    : logger.error(`Error while processing message: ${e}`);
            }
        });

        this.websocketClient.onerror = (error) => {
            logger.error(`WebSocket error: `, error);
        }
    }

    //Dev only function that posts events to websocket in absence of an indexer
    async emitBountyCompleteEvent(bounty_id: string) {
        if ((this.config.nearConnection.networkId !== "mainnet" || process.env.EMIT_BOUNTY__ALLOW_MAINNET) && process.env.EMIT_BOUNTY__PUBLISH_COMPLETE_EVENT) {
            logger.info(`Publishing bounty_completed event for ${bounty_id}`)
            const bounty = await this.coordinatorContract.get_bounty({bounty_id})
            if (bounty.status !== BountyStatuses.Pending) {
                logger.info(`Bounty ${bounty_id} is not pending, not emitting bounty_completed event`)
            }
            const bce: BountyCompletedEvent = {
                event: "bounty_completed",
                data: {
                    bounty_id: bounty_id,
                    coordinator_id: this.config.coordinatorContractId,
                    node_ids: bounty.elected_nodes,
                    payout_node_ids: bounty.elected_nodes,
                    payout_strategy: PayoutStrategies.SuccessfulNodes,
                    outcome: BountyStatuses.Success,
                }
            }
            logger.info(`Emitting bounty_completed event for ${bounty_id} with payload: `, bce)
            await publishEventToWebsocketRelay(bounty.id, bce);
        }
    }

    // Periodically ping the websocket to keep the connection alive
    async heartbeat() {
        logger.debug(`Sending heartbeat to websocket`)
        if(this.websocketClient){
            this.websocketClient.ping();
        }
        // this.websocketClient.send("Are you still there?")
    }
}


const init = async () => {
    const config = readConfigFromEnv()
    const account = await getAccount(config, config.accountId);
    const coordinatorContract = await getCoordinatorContract(config, account)
    const client = new ExecutionClient(account, coordinatorContract, config);
    await client.initialize();
    setInterval(client.heartbeat, 10000)

    // Creates a bounty at a defined interval. Used fomFFr development to keep a constant stream of bounty events going
    // Default block when attempting to run against mainnet since it'll cost real near. Pass EMIT_BOUNTY__ALLOW_MAINNET to override
    if ((config.nearConnection.networkId !== "mainnet" || process.env.EMIT_BOUNTY__ALLOW_MAINNET) && process.env.EMIT_BOUNTY) {
        const emitInterval = parseInt(process.env.EMIT_BOUNTY__INTERVAL || "10000")
        logger.info(`Emitting bounties every ${emitInterval}ms`);
        await emitBounty(client.config, client.coordinatorContract, emitInterval)
    }
}

//TODO make host and port configurable
export const server = new WebSocket.Server({
    host: process.env.WEBSOCKET_HOST || "0.0.0.0",
    port: parseInt(process.env.WEBSOCKET_PORT || "8081")
});

export const subscribers: Map<WebSocket, WebSocket> = new Map();
server.on("connection", (ws, req) => {
    logger.error(`"WS Connection open"`);

    subscribers.set(ws, ws);

    ws.on("close", () => {
        subscribers.delete(ws);
    });


    ws.on("message", (messageAsString) => {
        try {
            logger.debug(messageAsString)
            const message = JSON.parse(messageAsString.toString());
            logger.debug(`Subscriber received message: `, message)
        } catch (e) {
            logger.error("Bad message", e);
        }
    });
});


(async () => {
    await init()
    // await start()
})()