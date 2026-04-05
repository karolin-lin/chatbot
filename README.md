## Psychological Study Chatbot (5-minute timer)

This project is a simple study chat system:

- Participant must enter an ID before starting
- A 5-minute timed chat session starts
- Messages (user + assistant) are logged under `backend/study_logs/` — **one CSV file per participant** (filename derived from their ID)

### Backend (FastAPI)

1) Create env file:

- Copy `backend/.env.example` to `backend/.env`
- Set `OPENAI_API_KEY`

2) Install deps:

```bash
python3 -m pip install -r backend/requirements.txt
```

3) Run API:

```bash
cd backend
python3 -m uvicorn app.main:app --reload --port 8000
```

### Frontend (Next.js)

```bash
cd frontend
npm install
npm run dev
```

Open `http://localhost:3000`.

