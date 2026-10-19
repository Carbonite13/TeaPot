from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from pydantic_settings import BaseSettings
from pydantic import Field
from typing import Literal
from functools import lru_cache
import logging

from SlicerAPI.api.v1.routes import generateRouter

## configure logging
log = logging.getLogger(__name__)
log.setLevel(logging.DEBUG)

## Configuration section
class Config(BaseSettings):
    profile: Literal["dev", "prod"] = Field(default="dev")

@lru_cache
def getConfig() -> Config:
    return Config()  # type: ignore

log.debug("Initialising configuration")
config = getConfig()

## main app configuration
def main(config: Config) -> FastAPI:

    log.debug("Initialising the application")
    app = FastAPI(
        title="SlicerAPI",
        docs_url="/docs",
        default_response_class=JSONResponse,
        debug=config.profile == "dev",
    )

    log.debug("Including routers")
    app.include_router(generateRouter, prefix="/v1/generate")

    log.debug("Configurating CORS...")
    app.add_middleware(
        CORSMiddleware,
        allow_origins=['*'],
        allow_methods=["GET", "POST"],
        allow_headers=['*']
    )

    return app

app = main(config)