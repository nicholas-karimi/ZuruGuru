import random
from datetime import datetime, timedelta

from app.database import Base, engine, SessionLocal
from app.models import POI, VisitorLocation, SOSAlert


def reset_database() -> None:
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)


def seed_pois(db):
    pois = [
        POI(
            name="Konza Innovation Hub",
            type="Hub",
            description="Central hub for startups and innovation showcases.",
            fun_fact="Konza Technopolis is often called the 'Silicon Savannah' of Africa.",
            image_url="https://images.pexels.com/photos/7915260/pexels-photo-7915260.jpeg",
            lat=-1.5875,
            lng=37.1285,
        ),
        POI(
            name="Smart Mobility Center",
            type="Transport",
            description="Command center for smart mobility and autonomous shuttles.",
            fun_fact="Konza aims to run one of the most efficient smart mobility grids in Africa.",
            image_url="https://images.pexels.com/photos/799443/pexels-photo-799443.jpeg",
            lat=-1.5882,
            lng=37.129,
        ),
        POI(
            name="Green Energy Pavilion",
            type="Energy",
            description="Showcase of sustainable and renewable energy solutions.",
            fun_fact="Over 30% of Konza’s energy mix is planned to be from renewables.",
            image_url="https://images.pexels.com/photos/4249346/pexels-photo-4249346.jpeg",
            lat=-1.5887,
            lng=37.1275,
        ),
        POI(
            name="Cybersecurity Operations Center",
            type="Security",
            description="Real-time monitoring hub for digital infrastructure.",
            fun_fact="Konza is designed with cybersecurity and privacy-by-design from day one.",
            image_url="https://images.pexels.com/photos/5380642/pexels-photo-5380642.jpeg",
            lat=-1.5879,
            lng=37.1278,
        ),
        POI(
            name="Visitor Experience Lobby",
            type="Experience",
            description="Immersive arrival lobby with interactive displays.",
            fun_fact="Indoor navigation is powered fully by QR and WiFi beacons.",
            image_url="https://images.pexels.com/photos/380769/pexels-photo-380769.jpeg",
            lat=-1.5872,
            lng=37.1282,
        ),
        POI(
            name="Konza Power Distribution Station (DS2)",
            type="Energy",
            description="The Konza Power Distribution Station (DS2) was commissioned by H.E Dr. William Ruto on 13th October 2025. The new distribution capacity enables Konza Technopolis to manage and distribute power internally across phase one of the development, significantly enhancing reliability and operational efficiency.",
            fun_fact="Designed as an intelligent and resilient energy system, Konza Smart Energy forms a core component of the city’s smart infrastructure architecture.",
            image_url="https://images.pexels.com/photos/4917803/pexels-photo-4917803.jpeg",
            lat=-1.5877,
            lng=37.1279,
        ),
    ]

    db.add_all(pois)
    db.commit()


def seed_visitor_locations(db, days_back: int = 1, count: int = 220) -> None:
    base_lat = -1.5880
    base_lng = 37.1280

    now = datetime.utcnow()
    start_time = now - timedelta(days=days_back)

    visitor_ids = [f"VISITOR-{i}" for i in range(1, 26)]

    locations = []
    for _ in range(count):
        visitor_id = random.choice(visitor_ids)
        lat = base_lat + random.uniform(-0.0015, 0.0015)
        lng = base_lng + random.uniform(-0.0015, 0.0015)
        floor_id = random.choice([0, 1, 2])
        timestamp = start_time + timedelta(
            seconds=random.randint(0, int((now - start_time).total_seconds()))
        )

        locations.append(
            VisitorLocation(
                visitor_id=visitor_id,
                floor_id=floor_id,
                lat=lat,
                lng=lng,
                timestamp=timestamp,
            )
        )

    db.add_all(locations)
    db.commit()


def seed_sos_alerts(db) -> None:
    now = datetime.utcnow()
    alerts = [
        SOSAlert(
            visitor_id="VISITOR-EMERGENCY-1",
            floor_id=1,
            lat=-1.5876,
            lng=37.1281,
            timestamp=now - timedelta(minutes=45),
            status="resolved",
        ),
        SOSAlert(
            visitor_id="VISITOR-EMERGENCY-2",
            floor_id=2,
            lat=-1.5883,
            lng=37.1279,
            timestamp=now - timedelta(minutes=15),
            status="open",
        ),
    ]
    db.add_all(alerts)
    db.commit()


def main() -> None:
    reset_database()
    db = SessionLocal()
    try:
        seed_pois(db)
        seed_visitor_locations(db)
        seed_sos_alerts(db)
        print("Database seeded successfully with Konza demo data.")
    finally:
        db.close()


if __name__ == "__main__":
    main()

