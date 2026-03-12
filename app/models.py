from datetime import datetime

from sqlalchemy import Column, Integer, String, Float, DateTime

from .database import Base


class POI(Base):
    __tablename__ = "pois"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    type = Column(String, nullable=False)
    description = Column(String, nullable=False)
    fun_fact = Column(String, nullable=False)
    image_url = Column(String, nullable=False)
    lat = Column(Float, nullable=False)
    lng = Column(Float, nullable=False)


class VisitorLocation(Base):
    __tablename__ = "visitor_locations"

    id = Column(Integer, primary_key=True, index=True)
    visitor_id = Column(String, index=True, nullable=False)
    floor_id = Column(Integer, nullable=False)
    lat = Column(Float, nullable=False)
    lng = Column(Float, nullable=False)
    timestamp = Column(DateTime, default=datetime.utcnow, index=True, nullable=False)


class SOSAlert(Base):
    __tablename__ = "sos_alerts"

    id = Column(Integer, primary_key=True, index=True)
    visitor_id = Column(String, index=True, nullable=False)
    floor_id = Column(Integer, nullable=False)
    lat = Column(Float, nullable=False)
    lng = Column(Float, nullable=False)
    timestamp = Column(DateTime, default=datetime.utcnow, index=True, nullable=False)
    status = Column(String, default="open", nullable=False)

