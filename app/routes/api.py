from datetime import datetime, date

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import SessionLocal
from app.models import POI, VisitorLocation, SOSAlert
from app.websocket import manager

router = APIRouter(prefix="/api", tags=["api"])


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# ---------- POIs ----------


@router.get("/pois")
def list_pois(db: Session = Depends(get_db)):
    pois = db.query(POI).all()
    return [
        {
            "id": poi.id,
            "name": poi.name,
            "type": poi.type,
            "description": poi.description,
            "fun_fact": poi.fun_fact,
            "image_url": poi.image_url,
            "lat": poi.lat,
            "lng": poi.lng,
        }
        for poi in pois
    ]


@router.post("/pois")
def create_poi(payload: dict, db: Session = Depends(get_db)):
    required = ["name", "type", "description", "fun_fact", "image_url", "lat", "lng"]
    for key in required:
        if key not in payload:
            raise HTTPException(status_code=400, detail=f"Missing field: {key}")

    poi = POI(
        name=payload["name"],
        type=payload["type"],
        description=payload["description"],
        fun_fact=payload["fun_fact"],
        image_url=payload["image_url"],
        lat=float(payload["lat"]),
        lng=float(payload["lng"]),
    )
    db.add(poi)
    db.commit()
    db.refresh(poi)
    return {"id": poi.id}


@router.put("/pois/{poi_id}")
def update_poi(poi_id: int, payload: dict, db: Session = Depends(get_db)):
    poi = db.query(POI).filter(POI.id == poi_id).first()
    if not poi:
        raise HTTPException(status_code=404, detail="POI not found")

    for field in ["name", "type", "description", "fun_fact", "image_url", "lat", "lng"]:
        if field in payload:
            setattr(poi, field, payload[field])

    db.commit()
    return {"status": "ok"}


@router.delete("/pois/{poi_id}")
def delete_poi(poi_id: int, db: Session = Depends(get_db)):
    poi = db.query(POI).filter(POI.id == poi_id).first()
    if not poi:
        raise HTTPException(status_code=404, detail="POI not found")

    db.delete(poi)
    db.commit()
    return {"status": "deleted"}


# ---------- Visitor Tracking & Heatmap ----------


@router.post("/visitor/location")
async def update_visitor_location(payload: dict, db: Session = Depends(get_db)):
    required = ["visitor_id", "floor_id", "lat", "lng", "timestamp"]
    for key in required:
        if key not in payload:
            raise HTTPException(status_code=400, detail=f"Missing field: {key}")

    try:
        ts = datetime.fromisoformat(payload["timestamp"])
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid timestamp format")

    location = VisitorLocation(
        visitor_id=payload["visitor_id"],
        floor_id=int(payload["floor_id"]),
        lat=float(payload["lat"]),
        lng=float(payload["lng"]),
        timestamp=ts,
    )
    db.add(location)
    db.commit()
    db.refresh(location)

    # Broadcast to WebSocket clients for live tracking
    await manager.broadcast(
        {
            "type": "location",
            "visitor_id": location.visitor_id,
            "floor_id": location.floor_id,
            "lat": location.lat,
            "lng": location.lng,
            "timestamp": location.timestamp.isoformat(),
        }
    )

    return {"status": "ok"}


@router.get("/visitor/heatmap")
def visitor_heatmap(db: Session = Depends(get_db)):
    locations = db.query(VisitorLocation).all()
    return [
        {
            "visitor_id": loc.visitor_id,
            "floor_id": loc.floor_id,
            "lat": loc.lat,
            "lng": loc.lng,
            "timestamp": loc.timestamp.isoformat(),
        }
        for loc in locations
    ]


@router.get("/visitor/stats")
def visitor_stats(db: Session = Depends(get_db)):
    today = date.today()
    start = datetime(today.year, today.month, today.day)
    total_today = (
        db.query(VisitorLocation)
        .filter(VisitorLocation.timestamp >= start)
        .count()
    )
    return {"total_visitors_today": total_today}


# ---------- SOS ----------


@router.post("/sos")
async def create_sos(payload: dict, db: Session = Depends(get_db)):
    required = ["visitor_id", "floor_id", "lat", "lng", "timestamp"]
    for key in required:
        if key not in payload:
            raise HTTPException(status_code=400, detail=f"Missing field: {key}")

    try:
        ts = datetime.fromisoformat(payload["timestamp"])
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid timestamp format")

    alert = SOSAlert(
        visitor_id=payload["visitor_id"],
        floor_id=int(payload["floor_id"]),
        lat=float(payload["lat"]),
        lng=float(payload["lng"]),
        timestamp=ts,
        status="open",
    )
    db.add(alert)
    db.commit()
    db.refresh(alert)

    await manager.broadcast(
        {
            "type": "sos",
            "id": alert.id,
            "visitor_id": alert.visitor_id,
            "floor_id": alert.floor_id,
            "lat": alert.lat,
            "lng": alert.lng,
            "timestamp": alert.timestamp.isoformat(),
            "status": alert.status,
        }
    )

    return {"status": "ok", "id": alert.id}


@router.get("/sos")
def list_sos(db: Session = Depends(get_db)):
    alerts = db.query(SOSAlert).order_by(SOSAlert.timestamp.desc()).all()
    return [
        {
            "id": a.id,
            "visitor_id": a.visitor_id,
            "floor_id": a.floor_id,
            "lat": a.lat,
            "lng": a.lng,
            "timestamp": a.timestamp.isoformat(),
            "status": a.status,
        }
        for a in alerts
    ]