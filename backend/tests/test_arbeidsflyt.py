"""Backend tests for Arbeidsflyt-kontroll app"""
import pytest
import requests
import os

BASE_URL = os.environ.get('EXPO_PUBLIC_BACKEND_URL', '').rstrip('/')

@pytest.fixture
def client():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s

# Health / Jobs list
class TestJobs:
    def test_get_jobs_returns_list(self, client):
        r = client.get(f"{BASE_URL}/api/jobs")
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data, list)
        print(f"Jobs count: {len(data)}")

    def test_seeded_jobs_exist(self, client):
        r = client.get(f"{BASE_URL}/api/jobs")
        assert r.status_code == 200
        names = [j['name'] for j in r.json()]
        print(f"Job names: {names}")
        assert any('Kabelpåvisning' in n for n in names) or any('Inspeksjon' in n for n in names), \
            f"Expected seeded jobs, got: {names}"

    def test_create_job(self, client):
        payload = {"name": "TEST_Job", "description": "Test description", "tasks": []}
        r = client.post(f"{BASE_URL}/api/jobs", json=payload)
        assert r.status_code == 200
        data = r.json()
        assert data['name'] == "TEST_Job"
        assert 'id' in data
        # cleanup
        client.delete(f"{BASE_URL}/api/jobs/{data['id']}")

    def test_create_job_with_tasks(self, client):
        payload = {
            "name": "TEST_JobWithTasks",
            "description": "",
            "tasks": [
                {
                    "id": "t1",
                    "question": "Er alt ok?",
                    "yes_action": "complete",
                    "yes_subtasks": [],
                    "no_action": "create_subtasks",
                    "no_subtasks": [
                        {"id": "t1-1", "question": "Hva er galt?", "yes_action": "complete",
                         "yes_subtasks": [], "no_action": "complete", "no_subtasks": []}
                    ]
                }
            ]
        }
        r = client.post(f"{BASE_URL}/api/jobs", json=payload)
        assert r.status_code == 200
        data = r.json()
        assert len(data['tasks']) == 1
        job_id = data['id']
        # Verify GET
        r2 = client.get(f"{BASE_URL}/api/jobs/{job_id}")
        assert r2.status_code == 200
        assert len(r2.json()['tasks']) == 1
        client.delete(f"{BASE_URL}/api/jobs/{job_id}")

    def test_get_job_by_id(self, client):
        # Create then get
        r = client.post(f"{BASE_URL}/api/jobs", json={"name": "TEST_GetById", "description": "", "tasks": []})
        job_id = r.json()['id']
        r2 = client.get(f"{BASE_URL}/api/jobs/{job_id}")
        assert r2.status_code == 200
        assert r2.json()['id'] == job_id
        client.delete(f"{BASE_URL}/api/jobs/{job_id}")

    def test_update_job(self, client):
        r = client.post(f"{BASE_URL}/api/jobs", json={"name": "TEST_UpdateJob", "description": "", "tasks": []})
        job_id = r.json()['id']
        r2 = client.put(f"{BASE_URL}/api/jobs/{job_id}", json={"name": "TEST_UpdatedName", "description": "Updated", "tasks": []})
        assert r2.status_code == 200
        assert r2.json()['name'] == "TEST_UpdatedName"
        client.delete(f"{BASE_URL}/api/jobs/{job_id}")

    def test_delete_job(self, client):
        r = client.post(f"{BASE_URL}/api/jobs", json={"name": "TEST_DeleteJob", "description": "", "tasks": []})
        job_id = r.json()['id']
        r2 = client.delete(f"{BASE_URL}/api/jobs/{job_id}")
        assert r2.status_code == 200
        r3 = client.get(f"{BASE_URL}/api/jobs/{job_id}")
        assert r3.status_code == 404

    def test_get_nonexistent_job(self, client):
        r = client.get(f"{BASE_URL}/api/jobs/nonexistent-id")
        assert r.status_code == 404


class TestSessions:
    def test_create_session(self, client):
        # Get a job first
        jobs = client.get(f"{BASE_URL}/api/jobs").json()
        assert len(jobs) > 0
        job = jobs[0]
        r = client.post(f"{BASE_URL}/api/sessions", json={"job_id": job['id'], "job_name": job['name']})
        assert r.status_code == 200
        data = r.json()
        assert data['job_id'] == job['id']
        assert data['status'] == 'in_progress'
        assert 'id' in data

    def test_get_session(self, client):
        jobs = client.get(f"{BASE_URL}/api/jobs").json()
        job = jobs[0]
        r = client.post(f"{BASE_URL}/api/sessions", json={"job_id": job['id'], "job_name": job['name']})
        sess_id = r.json()['id']
        r2 = client.get(f"{BASE_URL}/api/sessions/{sess_id}")
        assert r2.status_code == 200
        assert r2.json()['id'] == sess_id

    def test_update_session_with_answers(self, client):
        jobs = client.get(f"{BASE_URL}/api/jobs").json()
        job = jobs[0]
        r = client.post(f"{BASE_URL}/api/sessions", json={"job_id": job['id'], "job_name": job['name']})
        sess_id = r.json()['id']
        answers = [{"task_id": "t1", "question": "Q?", "answer": "ja",
                    "answered_at": "2025-01-01T10:00:00Z", "level": 0, "parent_id": None}]
        r2 = client.put(f"{BASE_URL}/api/sessions/{sess_id}", json={"answers": answers})
        assert r2.status_code == 200
        assert len(r2.json()['answers']) == 1

    def test_complete_session(self, client):
        jobs = client.get(f"{BASE_URL}/api/jobs").json()
        job = jobs[0]
        r = client.post(f"{BASE_URL}/api/sessions", json={"job_id": job['id'], "job_name": job['name']})
        sess_id = r.json()['id']
        r2 = client.put(f"{BASE_URL}/api/sessions/{sess_id}", json={
            "answers": [],
            "status": "completed",
            "completed_at": "2025-01-01T12:00:00Z"
        })
        assert r2.status_code == 200
        assert r2.json()['status'] == 'completed'


class TestConfig:
    def test_export_config(self, client):
        r = client.get(f"{BASE_URL}/api/config/export")
        assert r.status_code == 200
        data = r.json()
        assert 'jobs' in data
        assert isinstance(data['jobs'], list)

    def test_import_config(self, client):
        payload = {"jobs": [{"name": "TEST_ImportedJob", "description": "Imported", "tasks": []}]}
        r = client.post(f"{BASE_URL}/api/config/import", json=payload)
        assert r.status_code == 200
        data = r.json()
        assert data['count'] == 1

    def test_seed_endpoint(self, client):
        r = client.post(f"{BASE_URL}/api/seed")
        assert r.status_code == 200
