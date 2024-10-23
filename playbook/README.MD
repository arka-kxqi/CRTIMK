# F.A.W.S. Installer

This folder contains all files used in the one line installer for the [execution client](../execution-client/README.md).
The command is as follows:

Testnet
```shell
curl -H 'Cache-Control: no-cache' -o- https://raw.githubusercontent.com/ad0ll/faws/main/playbook/install.sh | ACCOUNT_ID=faws-demo1.testnet NODE_NAME=vm-node1 WEBSOCKET_URL=ws://127.0.0.1:8000/ws bash
```

Mainnet
```shell
curl -H 'Cache-Control: no-cache' -o- https://raw.githubusercontent.com/ad0ll/faws/main/playbook/install.sh | ACCOUNT_ID=faws-demo1.test NODE_NAME=vm-node1  bash
```


## Development
The install is performed using a mix of raw shell commands and ansible playbooks. We later hope to have it be primarily playbooks.
