import React, { useContext } from "react";
import {
  Box,
  Button,
  Checkbox,
  FormControl,
  FormControlLabel,
  FormGroup,
  Modal,
  TextField,
  Typography,
} from "@mui/material";
import { WalletContext } from "../app";
import { ClientNode } from "../../../execution-client/types";

const modalStyle = {
  position: "absolute" as "absolute",
  top: "50%",
  left: "50%",
  transform: "translate(-50%, -50%)",
  width: 400,
  bgcolor: "background.paper",
  border: "2px solid #000",
  boxShadow: 24,
  p: 4,
};

export const UpdateNodeModal = ({
  node,
  open,
  handleClose,
}: {
  node: ClientNode;
  open: boolean;
  handleClose: () => void;
}) => {
  const wallet = useContext(WalletContext);
  const [state, setState] = React.useState({
    absolute_timeout: String(node.absolute_timeout),
    allow_network: node.allow_network,
    allow_gpu: node.allow_gpu,
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
  const handleSubmit = async () => {
    try {
      await wallet.updateNode(
        node.id,
        state.absolute_timeout,
        state.allow_network,
        state.allow_gpu
      );
      handleClose();
    } catch (e: any) {
      console.log(`Error updating node: ${e}`);
    }
  };
  return (
    <Modal
      open={open}
      onClose={handleClose}
      aria-labelledby="create-bounty-modal-title"
      aria-describedby="create-bounty-modal-description"
    >
      <Box sx={modalStyle}>
        <Typography id="create-bounty-modal-title" variant="h5" component="h2">
          Update Node
        </Typography>
        <FormGroup>
          <FormControl margin="normal">
            <TextField
              required
              fullWidth
              id="update-bounty-value"
              label="Absolute Timeout"
              variant="outlined"
              size="small"
              onChange={handleChange}
              value={node.absolute_timeout}
            />
          </FormControl>
          <FormControlLabel
            control={
              <Checkbox
                name="allow_network"
                onChange={handleChange}
                checked={state.allow_network}
              />
            }
            label="Allow Network"
          />
          <FormControlLabel
            control={
              <Checkbox
                name="allow_gpu"
                onChange={handleChange}
                checked={state.allow_gpu}
              />
            }
            label="Allow GPU"
          />
          <FormControl margin="normal">
            <Button variant="contained" onClick={handleSubmit}>
              Update
            </Button>
          </FormControl>
        </FormGroup>
      </Box>
    </Modal>
  );
};
