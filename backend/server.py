from fastapi import FastAPI, APIRouter, HTTPException
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional, Any
import uuid
from datetime import datetime, timezone

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

app = FastAPI()
api_router = APIRouter(prefix="/api")

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


# ===== PYDANTIC MODELS =====

class SubtaskConfig(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    question: str
    yes_action: str = "complete"  # "complete" | "create_subtasks"
    yes_subtasks: List['SubtaskConfig'] = []
    no_action: str = "complete"
    no_subtasks: List['SubtaskConfig'] = []

SubtaskConfig.model_rebuild()


class JobCreate(BaseModel):
    name: str
    description: str = ""
    tasks: List[SubtaskConfig] = []


class JobResponse(BaseModel):
    id: str
    name: str
    description: str
    tasks: List[Any]
    created_at: str
    updated_at: str


class AnswerRecord(BaseModel):
    task_id: str
    question: str
    answer: str  # "ja" | "nei"
    answered_at: str
    level: int = 0
    parent_id: Optional[str] = None


class SessionCreate(BaseModel):
    job_id: str
    job_name: str


class SessionResponse(BaseModel):
    id: str
    job_id: str
    job_name: str
    started_at: str
    completed_at: Optional[str] = None
    answers: List[Any] = []
    status: str


class SessionUpdate(BaseModel):
    answers: List[AnswerRecord]
    status: Optional[str] = None
    completed_at: Optional[str] = None


def serialize_doc(doc: dict) -> dict:
    result = dict(doc)
    if '_id' in result:
        result['id'] = str(result.pop('_id'))
    return result


# ===== JOBS =====

@api_router.get("/jobs", response_model=List[JobResponse])
async def get_jobs():
    jobs = await db.jobs.find().sort("created_at", -1).to_list(1000)
    return [serialize_doc(j) for j in jobs]


@api_router.post("/jobs", response_model=JobResponse)
async def create_job(job_data: JobCreate):
    now = datetime.now(timezone.utc).isoformat()
    doc = {
        "_id": str(uuid.uuid4()),
        "name": job_data.name,
        "description": job_data.description,
        "tasks": [t.model_dump() for t in job_data.tasks],
        "created_at": now,
        "updated_at": now,
    }
    await db.jobs.insert_one(doc)
    return serialize_doc(doc)


@api_router.get("/jobs/{job_id}", response_model=JobResponse)
async def get_job(job_id: str):
    job = await db.jobs.find_one({"_id": job_id})
    if not job:
        raise HTTPException(status_code=404, detail="Jobb ikke funnet")
    return serialize_doc(job)


@api_router.put("/jobs/{job_id}", response_model=JobResponse)
async def update_job(job_id: str, job_data: JobCreate):
    now = datetime.now(timezone.utc).isoformat()
    update = {
        "name": job_data.name,
        "description": job_data.description,
        "tasks": [t.model_dump() for t in job_data.tasks],
        "updated_at": now,
    }
    result = await db.jobs.find_one_and_update(
        {"_id": job_id},
        {"$set": update},
        return_document=True,
    )
    if not result:
        raise HTTPException(status_code=404, detail="Jobb ikke funnet")
    return serialize_doc(result)


@api_router.delete("/jobs/{job_id}")
async def delete_job(job_id: str):
    result = await db.jobs.delete_one({"_id": job_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Jobb ikke funnet")
    await db.sessions.delete_many({"job_id": job_id})
    return {"message": "Jobb slettet"}


# ===== SESSIONS =====

@api_router.post("/sessions", response_model=SessionResponse)
async def create_session(session_data: SessionCreate):
    now = datetime.now(timezone.utc).isoformat()
    doc = {
        "_id": str(uuid.uuid4()),
        "job_id": session_data.job_id,
        "job_name": session_data.job_name,
        "started_at": now,
        "completed_at": None,
        "answers": [],
        "status": "in_progress",
    }
    await db.sessions.insert_one(doc)
    return serialize_doc(doc)


@api_router.get("/sessions/{session_id}", response_model=SessionResponse)
async def get_session(session_id: str):
    session = await db.sessions.find_one({"_id": session_id})
    if not session:
        raise HTTPException(status_code=404, detail="Økt ikke funnet")
    return serialize_doc(session)


@api_router.put("/sessions/{session_id}", response_model=SessionResponse)
async def update_session(session_id: str, update_data: SessionUpdate):
    update: dict = {
        "answers": [a.model_dump() for a in update_data.answers],
    }
    if update_data.status:
        update["status"] = update_data.status
    if update_data.completed_at:
        update["completed_at"] = update_data.completed_at
    result = await db.sessions.find_one_and_update(
        {"_id": session_id},
        {"$set": update},
        return_document=True,
    )
    if not result:
        raise HTTPException(status_code=404, detail="Økt ikke funnet")
    return serialize_doc(result)


@api_router.get("/sessions", response_model=List[SessionResponse])
async def get_sessions(job_id: Optional[str] = None):
    query: dict = {}
    if job_id:
        query["job_id"] = job_id
    sessions = await db.sessions.find(query).sort("started_at", -1).to_list(1000)
    return [serialize_doc(s) for s in sessions]


# ===== CONFIG EXPORT / IMPORT =====

@api_router.get("/config/export")
async def export_config():
    jobs = await db.jobs.find().to_list(1000)
    return {"jobs": [serialize_doc(j) for j in jobs]}


@api_router.post("/config/import")
async def import_config(data: dict):
    jobs = data.get("jobs", [])
    imported = 0
    for job in jobs:
        job_id = job.get("id") or str(uuid.uuid4())
        now = datetime.now(timezone.utc).isoformat()
        doc = {
            "_id": job_id,
            "name": job.get("name", "Ukjent jobb"),
            "description": job.get("description", ""),
            "tasks": job.get("tasks", []),
            "created_at": job.get("created_at", now),
            "updated_at": now,
        }
        await db.jobs.replace_one({"_id": job_id}, doc, upsert=True)
        imported += 1
    return {"message": f"Importert {imported} jobber", "count": imported}


# ===== SEED EXAMPLE DATA =====

@api_router.post("/seed")
async def seed_data():
    count = await db.jobs.count_documents({})
    if count > 0:
        return {"message": "Testdata finnes allerede"}

    now = datetime.now(timezone.utc).isoformat()
    example_jobs = [
        {
            "_id": str(uuid.uuid4()),
            "name": "Kabelpåvisning",
            "description": "Kontroll og påvisning av kabelanlegg før graving",
            "tasks": [
                {
                    "id": str(uuid.uuid4()),
                    "question": "Er sikkerhetsutstyr på plass?",
                    "yes_action": "create_subtasks",
                    "yes_subtasks": [
                        {
                            "id": str(uuid.uuid4()),
                            "question": "Er verneutstyr kontrollert og godkjent?",
                            "yes_action": "complete",
                            "yes_subtasks": [],
                            "no_action": "create_subtasks",
                            "no_subtasks": [
                                {
                                    "id": str(uuid.uuid4()),
                                    "question": "Er defekt utstyr erstattet?",
                                    "yes_action": "complete",
                                    "yes_subtasks": [],
                                    "no_action": "complete",
                                    "no_subtasks": [],
                                }
                            ],
                        }
                    ],
                    "no_action": "complete",
                    "no_subtasks": [],
                },
                {
                    "id": str(uuid.uuid4()),
                    "question": "Er gravested markert i henhold til plan?",
                    "yes_action": "complete",
                    "yes_subtasks": [],
                    "no_action": "create_subtasks",
                    "no_subtasks": [
                        {
                            "id": str(uuid.uuid4()),
                            "question": "Er netteier varslet om avvik?",
                            "yes_action": "complete",
                            "yes_subtasks": [],
                            "no_action": "complete",
                            "no_subtasks": [],
                        }
                    ],
                },
                {
                    "id": str(uuid.uuid4()),
                    "question": "Er kabelkart mottatt og verifisert?",
                    "yes_action": "complete",
                    "yes_subtasks": [],
                    "no_action": "create_subtasks",
                    "no_subtasks": [
                        {
                            "id": str(uuid.uuid4()),
                            "question": "Er forespørsel om kabelkart sendt?",
                            "yes_action": "complete",
                            "yes_subtasks": [],
                            "no_action": "complete",
                            "no_subtasks": [],
                        }
                    ],
                },
            ],
            "created_at": now,
            "updated_at": now,
        },
        {
            "_id": str(uuid.uuid4()),
            "name": "Inspeksjon av rørledning",
            "description": "Visuell inspeksjon og dokumentasjon av rørledninger",
            "tasks": [
                {
                    "id": str(uuid.uuid4()),
                    "question": "Er tilgangspunkt åpent og sikkert?",
                    "yes_action": "complete",
                    "yes_subtasks": [],
                    "no_action": "create_subtasks",
                    "no_subtasks": [
                        {
                            "id": str(uuid.uuid4()),
                            "question": "Er sperring satt opp?",
                            "yes_action": "complete",
                            "yes_subtasks": [],
                            "no_action": "complete",
                            "no_subtasks": [],
                        }
                    ],
                },
                {
                    "id": str(uuid.uuid4()),
                    "question": "Er kamera-utstyr funksjonelt?",
                    "yes_action": "create_subtasks",
                    "yes_subtasks": [
                        {
                            "id": str(uuid.uuid4()),
                            "question": "Er kamera kalibrert?",
                            "yes_action": "complete",
                            "yes_subtasks": [],
                            "no_action": "complete",
                            "no_subtasks": [],
                        }
                    ],
                    "no_action": "create_subtasks",
                    "no_subtasks": [
                        {
                            "id": str(uuid.uuid4()),
                            "question": "Er reserveutstyr tilgjengelig?",
                            "yes_action": "complete",
                            "yes_subtasks": [],
                            "no_action": "complete",
                            "no_subtasks": [],
                        }
                    ],
                },
            ],
            "created_at": now,
            "updated_at": now,
        },
    ]
    await db.jobs.insert_many(example_jobs)
    return {"message": f"Lagt til {len(example_jobs)} eksempeljobber"}


app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
