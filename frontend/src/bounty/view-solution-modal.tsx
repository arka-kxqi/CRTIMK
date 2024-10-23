import React from "react";
import {Box, Modal, Table, TableBody, TableCell, TableHead, TableRow, Typography,} from "@mui/material";
import {selectorFamily, useRecoilValue} from "recoil";
import {BountyStatuses} from "../../../execution-client/types";
import {wallet} from "../index";
import ReactJson from 'react-json-view'

const modalStyle = {
    position: "absolute" as "absolute",
    top: "50%",
    left: "50%",
    transform: "translate(-50%, -50%)",
    bgcolor: "background.paper",
    border: "2px solid #000",
    boxShadow: 24,
    p: 4,
};


const answerSelector = selectorFamily({
    key: "answerSelector",
    get: (params: { bountyId: string, bountyStatus: string, modalOpen: boolean }) => async () => {
        const {bountyId, bountyStatus, modalOpen} = params;
        if (bountyStatus === BountyStatuses.Pending || !modalOpen) {
            return {}
        }
        return await wallet.getBountyResult(bountyId.toString())
    }
})


export const ViewBountySolutionModal = ({
                                            bountyId,
                                            bountyStatus,
                                            modalOpen,
                                            handleClose,
                                        }: {
    bountyId: string;
    bountyStatus: BountyStatuses;
    modalOpen: boolean;
    handleClose: React.Dispatch<React.SetStateAction<boolean>>;
}) => {

    const answer = useRecoilValue(answerSelector({bountyId, bountyStatus, modalOpen}))
    const [viewType, setViewType] = React.useState<"popular" | "average">("popular");


    console.log(answer)
    return (
        <Modal
            open={modalOpen}
            onClose={() => handleClose(false)}
            aria-labelledby="create-bounty-modal-title"
            aria-describedby="create-bounty-modal-description"
        >
            <Box sx={modalStyle}>
                <Typography
                    id="create-bounty-modal-title"
                    variant="h5"
                    component="h2"
                >
                    {bountyId} Solution
                </Typography>
                <Table sx={{marginBottom: 2}}>
                    <colgroup>
                        <col style={{width: '80%'}}/>
                        <col style={{width: '20%'}}/>
                    </colgroup>
                    <TableHead>
                        <TableRow>
                            <TableCell>Answer</TableCell>
                            <TableCell align={"center"}>Nodes</TableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>

                        {Object.entries(answer).map(([key, value]) => {
                            return <TableRow>
                                <TableCell><Typography>{key}</Typography></TableCell>
                                <TableCell align={"center"}>{value}</TableCell>
                            </TableRow>
                        })}
                    </TableBody>
                </Table>
                <Box>
                    <Typography variant={"h5"} sx={{marginBottom: 2}}>Raw result</Typography>
                    <ReactJson theme={"ocean"} src={answer}/>
                </Box>
            </Box>
        </Modal>
    );
};

