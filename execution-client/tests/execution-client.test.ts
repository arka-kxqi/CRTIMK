import {Bounty, BountyStatuses, ClientConfig, SupportedFileDownloadProtocols} from "../types";
import * as fs from "fs";
import shell from "shelljs";
import {readConfigFromEnv} from "../config";
import {Execution} from "../execution";
import anyTest, {ExecutionContext, TestFn} from "ava";

type TypedAvaExecutionContext = ExecutionContext<{ config: ClientConfig }>;
const test = anyTest as TestFn<{
    config: ClientConfig
}>;

const getExampleBounty = (config: ClientConfig, {
    id = `example-bounty`,
    owner_id = "example-owner",
    coordinator_id = "example-coordinator",
    file_location = "git@github.com:ad0ll/docker-hello-world.git",
    file_download_protocol = SupportedFileDownloadProtocols.GIT,
    success = false,
    complete = false,
    cancelled = false,
    min_nodes = 2,
    network_required = true,
    gpu_required = false,
    bounty_created = 0,
    amt_storage = BigInt(10000000000000000000).toString(),
    amt_node_reward = BigInt(10000000000000000000).toString(),
    timeout_seconds = 60000,
    elected_nodes  = [] as string[],
    answers = {},
    build_args = [] as string[],
    runtime_args = [] as string[],
}): Bounty => ({
    id,
    owner_id,
    coordinator_id,
    file_location,
    file_download_protocol,
    complete,
    cancelled,
    min_nodes,
    network_required,
    gpu_required,
    bounty_created,
    amt_storage,
    amt_node_reward,
    elected_nodes,
    answers,
    build_args,
    runtime_args,
    timeout_seconds,
    status: BountyStatuses.Pending
})

const downloadFileTest = async (t: TypedAvaExecutionContext, file_location: string, file_download_protocol: SupportedFileDownloadProtocols, forceRemove=false) => {
    const {config} = t.context;
    //TODO nodeConfig should come from context
    const execution = new Execution(config, {absoluteTimeout: 60000, allowGpu: false, allowNetwork: true}, getExampleBounty(config, {
        file_location,
        file_download_protocol,
    }))
    const {executionContext} = execution
    const {filesDir, packageName, packagePath, dockerfilePath} = executionContext.storage
    if( fs.existsSync(dockerfilePath) && !forceRemove) {
        console.log(`package has already been downloaded, skipping`)
        t.assert(fs.existsSync(dockerfilePath), `Dockerfile should be present at root after extraction`)
        return
    }
    if (fs.existsSync(filesDir)) {
        fs.rmSync(filesDir, {recursive: true})
    }
    fs.mkdirSync(filesDir, {recursive: true})
    await execution.downloadFile()
    if (!packageName.endsWith(".git")) {
        console.log(`encountered file path ending in zip/tar, zip/tar file should be present at root`, packagePath)
        t.assert(fs.existsSync(packagePath), `zip/tar file should be present at ${packagePath} after download`)
    } else { //git clones should clone pre-extracted
        console.log(`encountered file path ending in git, Dockerfile should be present at root`, dockerfilePath)
        t.assert(fs.existsSync(dockerfilePath), `Dockerfile should be present at ${dockerfilePath} after cloning git repo`)
    }
}

const downloadAndExtractFileTest = async (t: TypedAvaExecutionContext, file_location: string, file_download_protocol: SupportedFileDownloadProtocols, forceRemove=false): Promise<Execution> => {
    const {config} = t.context
    const execution = new Execution(config, {absoluteTimeout: 60000, allowGpu: false, allowNetwork: true}, getExampleBounty(config, {
        file_location,
        file_download_protocol,
    }))
    await downloadFileTest(t, file_location, file_download_protocol, forceRemove)
    const {bounty, storage} = execution.executionContext
    const {packagePath, dockerfilePath} = storage
    if (bounty.file_download_protocol !== SupportedFileDownloadProtocols.GIT) { //git repos should clone pre-extracted
        console.log(`extracting `, packagePath) //?
        await execution.extractFile()
    }
    t.assert(fs.existsSync(dockerfilePath), `Dockerfile should be present at root after extraction`)
    return execution;
}
const buildImageTest = async (t: TypedAvaExecutionContext, file_location: string, file_download_protocol: SupportedFileDownloadProtocols, buildArgs: string[] =[]): Promise<Execution> => {
    const config = readConfigFromEnv()
    const execution = await downloadAndExtractFileTest(t, file_location, file_download_protocol)
    execution.executionContext.bounty.build_args = buildArgs
    await execution.buildImage()
    const {imageName} = execution.executionContext
    console.log(`checking for ${imageName}`)
    const {code, stdout} = shell.exec(`docker images ${imageName} -q`)
    t.assert(code === 0, `docker images ${imageName} -q should return 0`)
    console.log(`found image ${imageName} with id ${stdout}`)
    return execution;
}

test.before((t) => {
    const config = readConfigFromEnv()
    t.context = {
        config
    }
})

test.after(t => {
    const {config} = t.context as { config: ClientConfig }
    const deleteContents = process.env.TEST_DELETE_CONTENTS !== "false" || false
    if (deleteContents) {    // Delete all files created for testing
        if (fs.existsSync(config.bountyStorageDir)) {
            fs.rmSync(config.bountyStorageDir, {recursive: true})
        }
    }
    // Prune dangling docker contents
    shell.exec("docker system prune -f")
})

test.serial("can download file with git", async t => {
    await downloadFileTest(t, "git@github.com:ad0ll/docker-hello-world.git", SupportedFileDownloadProtocols.GIT, true)
})

test.serial("can download file with http", async t => {
    await downloadFileTest(t, "https://github.com/ad0ll/docker-hello-world/archive/refs/heads/main.zip", SupportedFileDownloadProtocols.HTTPS, true)
})

test.serial("can extract (which does nothing) with git", async t => {
    await downloadAndExtractFileTest(t, "git@github.com:ad0ll/docker-hello-world.git", SupportedFileDownloadProtocols.GIT, true)
})

test.serial("can extract file with zip", async t => {
    await downloadAndExtractFileTest(t, "https://github.com/ad0ll/docker-hello-world/archive/refs/heads/main.zip", SupportedFileDownloadProtocols.HTTPS, true)
})

test.serial("image build error results in failure", async t => {
    const error = await t.throwsAsync(buildImageTest(t, "git@github.com:ad0ll/docker-hello-world.git", SupportedFileDownloadProtocols.GIT, ["FORCE_ERROR=yes"]))
    console.log(`error: `, error)
})

test.serial("can build image", async t => {
    await buildImageTest(t, "git@github.com:ad0ll/docker-hello-world.git", SupportedFileDownloadProtocols.GIT)
})

test("running image without errors is success", async t => {
    const execution = await buildImageTest(t, "git@github.com:ad0ll/docker-hello-world.git", SupportedFileDownloadProtocols.GIT)
    execution.executionContext.containerName = execution.executionContext.containerName + "-no-error"
    const res = await execution.runImage()
    console.log(res)
    t.assert(res.result !== "")
})

test("running image with no output is failure", async t => {
    const execution = await buildImageTest(t, "git@github.com:ad0ll/docker-hello-world.git", SupportedFileDownloadProtocols.GIT)
    execution.executionContext.containerName = execution.executionContext.containerName + "-no-output"
    execution.executionContext.bounty.runtime_args = ["NO_RESULT"]
    const error = await t.throwsAsync(execution.runImage())
    console.log(`error`, error)
})

test("running image with malformed output is failure", async t => {
    const execution = await buildImageTest(t, "git@github.com:ad0ll/docker-hello-world.git", SupportedFileDownloadProtocols.GIT)
    execution.executionContext.containerName = execution.executionContext.containerName + "-malformed-output"
    execution.executionContext.bounty.runtime_args = ["MALFORMED_RESULT"]
    const error = await t.throwsAsync(execution.runImage())
    console.log(`error`, error)
})
test("running image with expected error is failure", async t => {
    const execution = await buildImageTest(t, "git@github.com:ad0ll/docker-hello-world.git", SupportedFileDownloadProtocols.GIT)
    execution.executionContext.containerName = execution.executionContext.containerName + "-expected-error"
    execution.executionContext.bounty.runtime_args = ["EXPECTED_ERROR"]
    const error = await t.throwsAsync(execution.runImage())
    console.log(`error`, error)
})

test("running image with unexpected error is failure", async t => {
    const execution = await buildImageTest(t, "git@github.com:ad0ll/docker-hello-world.git", SupportedFileDownloadProtocols.GIT)
    execution.executionContext.containerName = execution.executionContext.containerName + "-unexpected-error"
    execution.executionContext.bounty.runtime_args = ["UNEXPECTED_ERROR"]
    const error = await t.throwsAsync(execution.runImage())
    console.log(`error`, error)
})

test("running image with timeout is failure", async t => {
    t.assert(true)
    //TODO
    // const execution = await buildImageTest(t, "git@github.com:ad0ll/docker-hello-world.git", SupportedFileDownloadProtocols.GIT)
    // execution.executionContext.bounty.runtime_args = ["TIMEOUT"]
    // const error = await t.throwsAsync(execution.runImage())
    // console.log(`error`, error)
})