FROM node:18-slim

# Run with -v /var/run/docker.sock:/var/run/docker.sock for docker-in-docker
USER root

# Docker prerequisites
RUN apt-get update \
&& apt install -y \
    ca-certificates \
    curl \
    gnupg \
    lsb-release
RUN mkdir -p /etc/apt/keyrings \
&& curl -fsSL https://download.docker.com/linux/debian/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg \
&& echo \
      "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/debian \
        $(lsb_release -cs) stable" | tee /etc/apt/sources.list.d/docker.list > /dev/null
# Install docker
RUN apt update && apt install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin

CMD tail -f /dev/null
