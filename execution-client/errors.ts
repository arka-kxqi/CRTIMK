

// Happens when the node is first starting, thrown if the node is missing software or is unable to go through its initialization ceremonies
// Typically fatal
export class SetupError extends Error {
    constructor(message: string) {
        super(message);
        this.name = "SetupError";
    }
}

// Everything prior to actual execution. Should attempt to retry.
export class PreflightError extends Error {
    constructor(message: string) {
        super(message);
        this.name = "PreflightError";
    }
}

//Some error in execution, this results in a FAILURE posted to the bounty
export class ExecutionError extends Error {
    constructor(message: string) {
        super(message);
        this.name = "ExecutionError";
    }
}

// Type of pre-flight error
export class BountyNotFoundError extends Error {
    constructor(message: string) {
        super(message);
        this.name = "BountyNotFoundError";
    }
}

// Error publishing the bounty to the network, should retry, but worst case the node will be unanswered
export class PostExecutionError extends Error {
    constructor(message: string) {
        super(message);
        this.name = "PostExecutionError";
    }
}


// Node rejected the bounty
export class BountyRejectionError extends Error {
    constructor(message: string) {
        super(message);
        this.name = "BountyRejectionError";
    }
}