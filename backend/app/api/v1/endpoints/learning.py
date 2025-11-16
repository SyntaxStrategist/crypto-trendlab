from fastapi import APIRouter, HTTPException, status

router = APIRouter()


@router.post("", summary="Train/evaluate models (placeholder)")
def learning_task():
	# Placeholder: no logic implemented yet
	raise HTTPException(status_code=status.HTTP_501_NOT_IMPLEMENTED, detail="Learning endpoint not implemented yet")


