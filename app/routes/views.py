from fastapi import APIRouter, Depends, Request
from fastapi.templating import Jinja2Templates
from sqlalchemy.orm import Session

from app.database import SessionLocal
from app.models import POI, VisitorLocation

router = APIRouter(tags=["views"])

templates = Jinja2Templates(directory="templates")


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@router.get("/")
def index(request: Request):
    # Visitor map is data-driven via JS; no heavy server context required
    return templates.TemplateResponse("index.html", {"request": request})


@router.get("/admin/pois")
def admin_pois(request: Request, db: Session = Depends(get_db)):
    pois = db.query(POI).all()
    total_visitors = db.query(VisitorLocation).count()
    return templates.TemplateResponse(
        "admin_pois.html",
        {
            "request": request,
            "pois": pois,
            "total_visitors": total_visitors,
        },
    )


@router.get("/admin/security")
def admin_security(request: Request):
    return templates.TemplateResponse("admin_security.html", {"request": request})