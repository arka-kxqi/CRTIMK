import {Execution} from "./execution";
import {logger} from "./logger";
import {subscribers} from "./index";
import {Bounty, ClientExecutionContext} from "./types";

// Exposes a transient record of past executions for viewing in the frontend

export type ClientMessage = {
    eventType: string,
    bountyId: string,
    context: ClientExecutionContext
    data: any,
    sentAt: number,
}
const MAX_RECORDS = process.env.MAX_RECORDS || 50; //TODO document me

export class Database {
    public key_queue: string[] = [];
    public executions: { [key: string]: Execution } = {} // Not deliberate

    notifySubscribers(eventType: string, bountyId: string, data: any) {
        const execution = this.get(bountyId)
        //@ts-ignore-next-line
        const message: ClientMessage = {
            eventType,
            bountyId,
            context: execution.executionContext,
            data,
            sentAt: Date.now()
        }
        subscribers.forEach((ws) => {
            ws.send(JSON.stringify(message))
        })
    }

    get(key: string) {
        return this.executions[key];
    }

    insert(key: string, execution: Execution) {
        if (this.executions[key]) {
            logger.debug(`Bounty with id ${key} is already present in database, skipping insert`);
            return;
        }
        this.executions[key] = execution;
        this.key_queue.unshift(key);
        this.notifySubscribers("BountyInsert", key, execution.executionContext);
        if (this.key_queue.length === MAX_RECORDS) {
            const rm = this.key_queue.pop();
            if (!rm) {
                logger.error(`Could not remove key from queue, key_queue is empty`);
                return
            }
            delete this.executions[rm];
            this.notifySubscribers("BountyDelete", rm, {});
        }

    }

    update(key: string, execution: Execution) {
        if (!this.executions[key]) {
            logger.info(`Bounty with id ${key} is not present in database, skipping update`);
            return;
        }
        this.executions[key] = execution;
        this.notifySubscribers("BountyUpdate", key, execution.executionContext);
    }


    //No need for delete, Bounties will be deleted when they're pushed out of the queue
}
