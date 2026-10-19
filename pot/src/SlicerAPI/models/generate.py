## Models for handling HTTP respones and requests

from typing_extensions import Doc
from pydantic import BaseModel, Field, ConfigDict
from typing import TypedDict, Annotated

__all__ = ["GenerateResponse"]

class GenerateResponse(BaseModel):
    model_config = ConfigDict(
        extra="ignore",
    )

    # fields required when querying
    natural_query: Annotated[str, Field(""), Doc("Requirements described in natural language")]
    parameteric_query: Annotated[dict, Field({}), Doc("Parametric values for the input")]
    
    # fields that will be included in the response
    raw_response: Annotated[str, Field(""), Doc("The raw response will be returned")]

    # decorated fields
    justification: Annotated[str, Field("")]
    counter_factuals: Annotated[str, Field("")]
    sst: Annotated[str, Field("")]
    sd: Annotated[str, Field("")]
    deployment_architecture: Annotated[str, Field("")]
