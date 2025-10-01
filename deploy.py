import logging
from truefoundry.deploy import (
    Port,
    LocalSource,
    NodeSelector,
    Build,
    DockerFileBuild,
    Resources,
    Service,
)

logging.basicConfig(level=logging.INFO)

service = Service(
    name="fast-mcp",
    image=Build(
        build_source=LocalSource(),
        build_spec=DockerFileBuild(
            dockerfile_path="./Dockerfile", build_context_path="./"
        ),
    ),
    resources=Resources(
        cpu_request=0.5,
        cpu_limit=0.5,
        memory_request=1000,
        memory_limit=1000,
        ephemeral_storage_request=500,
        ephemeral_storage_limit=500,
        node=NodeSelector(),
    ),
    ports=[
        Port(
            port=8096,
            protocol="TCP",
            expose=True,
            app_protocol="http",
            host="ml.tfy-eo.truefoundry.cloud",
            path="/fast-mcp-rishi-ws-8096/",
        )
    ],
    replicas=1.0,
)


service.deploy(workspace_fqn="tfy-ea-dev-eo-az:rishi-ws", wait=False)
