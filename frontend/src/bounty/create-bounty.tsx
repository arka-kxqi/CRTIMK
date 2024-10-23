import {
    Alert,
    Button,
    Checkbox,
    FormControl,
    FormControlLabel,
    FormGroup,
    Grid,
    InputLabel,
    List,
    ListItem,
    MenuItem,
    Select,
    TextField,
    Tooltip,
} from "@mui/material";
import React, {useContext, useTransition} from "react";
import {Bounty, SupportedFileDownloadProtocols,} from "../../../execution-client/types";
import {WalletContext} from "../app";
import HelpIcon from "@mui/icons-material/Help";

const NODE_PADDING = 1.25;
export const HelpText: React.FC<{ text: string }> = ({text}) => {
    return (
        <Tooltip title={text}>
            <HelpIcon/>
        </Tooltip>
    );
};

type BountyValidationError = Record<keyof Bounty, string> & {
    //Additional types of errors that don't map to specific bounty inputs
    not_enough_nodes: string;
    file_upload: string
};
export default function CreateBounty({
                                         handleClose,
                                         nodeCount,
                                     }: {
    handleClose: () => void;
    nodeCount: number;
}) {
    const wallet = useContext(WalletContext);
    const [inTransition, startTransition] = useTransition();
    const [error, setError] = React.useState<BountyValidationError>(
        {} as BountyValidationError
    );
    const [state, setState] = React.useState<Partial<Bounty>>({
        amt_node_reward: "0.1",
        amt_storage: "0.1",
        file_download_protocol: SupportedFileDownloadProtocols.GIT,
        file_location: "",
        gpu_required: false,
        min_nodes: 0,
        network_required: true,
        timeout_seconds: 60,
    });

    const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const value =
            event.target.type === "checkbox"
                ? event.target.checked
                : event.target.value;
        setState({
            ...state,
            [event.target.name]: value,
        });
    };

    const validateBounty = (bounty: Partial<Bounty>): BountyValidationError => {
        const stagedError = {} as BountyValidationError;
        if (!bounty.file_location) {
            stagedError.file_location = "File location is required";
        }
        if (!bounty.file_download_protocol) {
            stagedError.file_download_protocol = "File download protocol is required";
        }
        if (!bounty.min_nodes) {
            stagedError.min_nodes = "Minimum number of nodes is required";
        }
        if (!bounty.amt_storage) {
            stagedError.amt_storage = "Storage amount is required";
        }
        if (!bounty.amt_node_reward) {
            stagedError.amt_node_reward = "Node reward amount is required";
        }
        if (bounty.min_nodes <= 0) {
            stagedError.min_nodes = "Minimum number of nodes must be greater than 0";
        }
        if (Math.ceil(bounty.min_nodes * NODE_PADDING) > nodeCount) {
            stagedError.not_enough_nodes = `Not enough nodes to fill the bounty (requires ${NODE_PADDING * 100}% of min_nodes (${bounty.min_nodes})`;
        }
        return stagedError;
    };

    const handleSubmit = async () => {
        try {
            const tempError = validateBounty(state);
            setError(tempError);
            console.log(tempError)
            if (Object.keys(tempError).length === 0) {
                console.log("creating bounty", state)

                await wallet.createBounty(state).catch(error => {
                    console.log(`MUCH ERROR ${error}`)
                })
                handleClose();
            }
        } catch (e: any) {
        }
    };

    return (
        <>
            {Object.keys(error).length > 0 && (
                <Alert severity="error" variant="outlined" sx={{marginTop: "16px"}}>
                    <List>
                        {Object.values(error).map((e) => (
                            <ListItem>{e}</ListItem>
                        ))}
                    </List>
                </Alert>
            )}
            {inTransition ? <div>[Loading new results...]</div> : null}
            <Grid container rowSpacing={1} spacing={4}>
                <Grid item xs={6}>
                    <FormGroup>
                        <FormControl margin="normal">
                            <TextField
                                required
                                fullWidth
                                id="file-location"
                                label="Package URL"
                                variant="outlined"
                                size="small"
                                placeholder={"https://github.com/ad0ll/docker-hello-world.git"}
                                name="file_location"
                                onChange={handleChange}
                                value={state.file_location}
                                helperText={error.file_location}
                                error={error.file_location !== undefined}
                            />
                        </FormControl>
                        <FormControl size="small" margin="normal">
                            <InputLabel
                                required
                                id="file-download-protocol-select-label"
                                error={error.file_download_protocol !== undefined}
                            >
                                File Download Protocol
                            </InputLabel>
                            <Select
                                required
                                labelId="file-download-protocol-select-label"
                                id="file-download-protocol"
                                label="File Download Protocol"
                                onChange={handleChange}
                                size="small"
                                name="file_download_protocol"
                                value={state.file_download_protocol || SupportedFileDownloadProtocols.GIT}
                                error={error.file_download_protocol !== undefined}
                            >
                                {Object.values(SupportedFileDownloadProtocols).map(
                                    (protocol) => (
                                        <MenuItem key={protocol} value={protocol}>
                                            {protocol.toString()}
                                        </MenuItem>
                                    )
                                )}
                            </Select>
                        </FormControl>
                        <FormControl margin="normal">
                            <TextField
                                required
                                fullWidth
                                id="threshold"
                                label="Min Nodes"
                                variant="outlined"
                                size="small"
                                name="min_nodes"
                                InputProps={{
                                    endAdornment: (
                                        <HelpText
                                            text={
                                                "The minimum number of nodes required to complete the bounty."
                                            }
                                        />
                                    ),
                                }}
                                onChange={handleChange}
                                value={state.min_nodes}
                                helperText={error.min_nodes}
                                error={error.min_nodes !== undefined}
                            />
                        </FormControl>
                    </FormGroup>
                </Grid>
                <Grid item xs={6}>
                    <FormGroup>
                        <FormControl margin="normal">
                            <TextField
                                required
                                fullWidth
                                id="storage"
                                label="Storage (NEAR)"
                                variant="outlined"
                                size="small"
                                placeholder="Storage in NEAR"
                                name="amt_storage"
                                value={state.amt_storage}
                                onChange={handleChange}
                                error={error.amt_storage !== undefined}
                                helperText={error.amt_storage}
                                InputProps={{
                                    endAdornment: (
                                        <>
                                            {state.amt_storage
                                                ? `~${parseFloat(state.amt_storage) * 100}KB`
                                                : "~0KB"}
                                        </>
                                    ),
                                }}
                            />
                        </FormControl>
                        <FormControl margin="normal">
                            <TextField
                                required
                                fullWidth
                                id="reward"
                                label="Reward (NEAR)"
                                variant="outlined"
                                size="small"
                                placeholder="Reward in NEAR"
                                name="amt_node_reward"
                                onChange={handleChange}
                                value={state.amt_node_reward}
                                helperText={error.amt_node_reward}
                                error={error.amt_node_reward !== undefined}
                            />
                        </FormControl>
                        <FormControl margin="normal">
                            <TextField
                                fullWidth
                                id="timeout-seconds"
                                label="Bounty Timeout (seconds)"
                                value={state.timeout_seconds}
                                variant="outlined"
                                size="small"
                                name="timeout_seconds"
                                onChange={handleChange}
                            />
                        </FormControl>
                        <FormControlLabel
                            control={
                                <Checkbox
                                    name="network_required"
                                    onChange={handleChange}
                                    checked={state.network_required}
                                />
                            }
                            label="Network Required "
                        />
                        <FormControlLabel
                            control={
                                <Checkbox
                                    name="gpu_required"
                                    onChange={handleChange}
                                    checked={state.gpu_required}
                                />
                            }
                            label="GPU Required"
                        />
                    </FormGroup>
                </Grid>
            </Grid>
            <FormGroup>
                <FormControl margin="normal">
                    <input
                        accept="application/json"
                        style={{display: 'none'}}
                        id="raised-button-file"
                        multiple
                        type="file"
                        hidden
                        onChange={((e) => {
                            let reader: FileReader;

                            const onLoadEnd = (e) => {
                                const fileContent = reader.result
                                console.log(fileContent)
                                try {
                                    const res = JSON.parse(fileContent.toString())

                                    const newBounty: Partial<Bounty> = {
                                        file_location: res.file_location,
                                        file_download_protocol: res.file_download_protocol,
                                        min_nodes: res.min_nodes.toString(),
                                        amt_storage: res.amt_storage.toString(),
                                        amt_node_reward: res.amt_node_reward.toString(),
                                        timeout_seconds: res.timeout_seconds.toString(),
                                        network_required: res.network_required,
                                        gpu_required: res.gpu_required,
                                    }
                                    console.log("New bounty", newBounty)
                                    setState(newBounty)
                                } catch (e) {
                                    setError({...error, file_upload: "Invalid JSON file"})
                                }
                            }
                            reader = new FileReader();
                            reader.onloadend = onLoadEnd;
                            reader.readAsText(e.target.files[0]);

                        })}

                    />
                </FormControl>

                <FormControl margin="normal">
                    <Grid container spacing={2}>
                        <Grid item xs={6}>
                            <label htmlFor="raised-button-file">
                            <Button sx={{width: "100%"}} variant="outlined" component="span">
                                Import
                            </Button>
                            </label>

                        </Grid>
                        <Grid item xs={6}>
                    <Button sx={{width: "100%"}} variant="contained" onClick={handleSubmit}>
                        Create
                    </Button>
                        </Grid>

                    </Grid>
                </FormControl>
            </FormGroup>
        </>
    );
}
