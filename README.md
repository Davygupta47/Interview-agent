## Backend
```bash
cd backend
python -m venv venv
venv\Scripts\activate         
# source venv/bin/activate    
pip install -r requirements.txt

# Set your API key
cp .env.example .env
# Edit .env with your real GROQ_API_KEY or GEMINI_API_KEY

# Run the server
uvicorn main:app --reload --port 8000
```
### Frontend
```bash
cd frontend
npm install
npm run dev
```