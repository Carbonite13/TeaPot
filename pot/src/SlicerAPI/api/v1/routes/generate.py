from fastapi import APIRouter, Body
from fastapi.responses import JSONResponse
from models.generate import GenerateResponse

router = APIRouter(
    tags=["generate"]
)

@router.get("/", response_class=JSONResponse, response_model=GenerateResponse, status_code=200)
async def generate(content: GenerateResponse = Body()):
    return GenerateResponse(sst=content.sst) # pyright: ignore