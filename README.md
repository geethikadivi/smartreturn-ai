# SMARTRETURN AI 🛍️⚡

> **College-level Product Return, Exchange, Warranty and Purchase Management SaaS**

SMARTRETURN AI is a modern SaaS platform designed to help consumers track their purchases, monitor return deadline countdowns, manage warranty expirations, and maintain receipt records securely.

---

## 🛠️ Tech Stack & Architecture

- **Frontend**: React (Vite, JavaScript), Tailwind CSS v4 (`@tailwindcss/vite`), React Router DOM v6, Lucide React, React Context API.
- **Backend**: Python FastAPI, Pydantic v2, Uvicorn.
- **Database / Auth / Storage**: Supabase PostgreSQL, Supabase Auth, Row Level Security (RLS), Supabase Storage.
- **Design System**: White background with deep navy (`#0F172A`) and vibrant purple (`#7C3AED`) accents, rounded cards (`rounded-2xl`), and subtle elevation shadows.

### Architecture Highlights
- **Direct Supabase Interaction**: The frontend communicates directly with Supabase via the client anon key and Row Level Security (RLS). Users can view and manage only their own data.
- **FastAPI Bridge**: A lightweight Python FastAPI service provides a `/health` endpoint and CORS configuration. This service will be extended in future phases for Google Gemini AI features (receipt OCR, return policy extraction, dispute letter generation).
- **Storage Security**: User invoice files are organized by user UUID (`{user_id}/filename`) with strict storage RLS policies in the `invoices` bucket.

---

## 📂 Project Structure

```text
smartreturn-ai/
├── backend/
│   ├── db/                     # Database utilities & Supabase client config
│   │   └── __init__.py
│   ├── routers/                # Modular API route controllers
│   │   ├── __init__.py
│   │   └── invoices.py         # POST /api/invoices/extract Gemini Multimodal OCR
│   ├── schemas/                # Pydantic v2 validation models
│   │   ├── __init__.py
│   │   └── invoice.py          # InvoiceExtractionResult schema
│   ├── .env.example            # Backend env template (SUPABASE_*, GEMINI_API_KEY, PORT)
│   ├── .gitignore              # Ignores .venv, .env, __pycache__
│   ├── main.py                 # FastAPI application & CORS configuration
│   ├── requirements.txt        # Python backend dependencies (including google-genai, pillow)
│   └── schema.sql              # Supabase tables, triggers, RLS & Storage policies
├── frontend/
│   ├── public/
│   ├── src/
│   │   ├── components/
│   │   │   ├── ActivityFeed.jsx          # Deadlines feed with Loading/Empty/Error states
│   │   │   ├── DeleteConfirmModal.jsx    # Styled confirmation dialog with cascade warning
│   │   │   ├── Navbar.jsx                # Top bar with backend status & user menu
│   │   │   ├── ProtectedRoute.jsx        # Route guard redirecting to /login
│   │   │   ├── PurchaseDetailsModal.jsx  # Item details with signed invoice preview
│   │   │   ├── PurchaseFormModal.jsx     # Add/Edit purchase with auto-calculations & upload
│   │   │   ├── Sidebar.jsx               # Left navigation bar (mobile-collapsible)
│   │   │   └── StatCard.jsx              # Metric cards with badges & icons
│   │   ├── context/
│   │   │   └── AuthContext.jsx           # Supabase Auth session & context provider
│   │   ├── hooks/
│   │   │   └── useAuth.js                # Custom auth hook
│   │   ├── lib/
│   │   │   ├── dateUtils.js              # Date & currency helpers (timezone-safe)
│   │   │   ├── storageUtils.js           # Supabase Storage invoice upload & signed URLs
│   │   │   └── supabaseClient.js         # Supabase client singleton
│   │   ├── pages/
│   │   │   ├── AiAssistant.jsx           # AI assistant bridge placeholder
│   │   │   ├── Dashboard.jsx             # Real Supabase metrics & quick actions
│   │   │   ├── Login.jsx                 # Email/password authentication
│   │   │   ├── Purchases.jsx             # Full Purchases CRUD, Grid/Table views & filters
│   │   │   ├── Returns.jsx               # Return requests pipeline placeholder
│   │   │   ├── Settings.jsx              # Account and profile information
│   │   │   ├── Signup.jsx                # User registration & email confirmation
│   │   │   ├── UploadInvoice.jsx         # Invoice storage dropzone & direct add action
│   │   │   └── WarrantyAlerts.jsx        # Warranty notifications placeholder
│   │   ├── App.jsx                 # Application routes & layout wrapper
│   │   ├── index.css               # Tailwind CSS v4 entry point
│   │   └── main.jsx                # React DOM entry point
│   ├── .env.example            # Frontend environment variables template
│   ├── .gitignore              # Ignores node_modules, .env, dist
│   ├── index.html              # HTML entry point with Inter font
│   ├── package.json            # NPM dependencies & scripts
│   └── vite.config.js          # Vite config with @tailwindcss/vite plugin
├── .gitignore                  # Root Git ignore
└── README.md                   # Complete documentation & setup instructions
```

---

## 🚀 Setup & Running Instructions

### 1. Manual Supabase Setup

1. **Create a Supabase Project**:
   - Go to [supabase.com](https://supabase.com) and create a new project.
   - Note down your **Project URL** and **anon public key** from `Project Settings -> API`.

2. **Execute Database Schema**:
   - In your Supabase dashboard, open the **SQL Editor**.
   - Open and copy the contents of `backend/schema.sql`.
   - Paste into the SQL Editor and click **Run**.
   - This executes:
     - Creation of `profiles`, `purchases`, `return_requests`, and `reminders` tables.
     - The `set_updated_at()` trigger for automatic timestamp management.
     - The `handle_new_user()` trigger on `auth.users` that automatically populates `public.profiles`.
     - Indexes on `purchases(user_id)`, `purchases(return_deadline)`, and `return_requests(user_id, status)`.
     - Full Row Level Security (RLS) policies for all tables.
     - Storage bucket creation for `invoices` and `{user_id}/filename` folder RLS policies.
   - *Note for Phase 2*: If you already executed `schema.sql` previously, simply run `backend/schema.sql` again. It safely runs `ALTER TABLE public.purchases ADD COLUMN IF NOT EXISTS category TEXT;` and `ALTER TABLE public.purchases ADD COLUMN IF NOT EXISTS currency TEXT DEFAULT 'USD';`.

3. **Enable Email Authentication**:
   - In Supabase, navigate to **Authentication -> Providers -> Email**.
   - Ensure **Enable Email provider** is turned on.
   - *(Optional)* If "Confirm email" is enabled, new signups will see a "Check your email" prompt. If you turn off "Confirm email", users are logged in immediately upon registration.

4. **Verify Storage Bucket**:
   - Go to **Storage -> Buckets** in Supabase and confirm that the `invoices` bucket exists.

---

### 2. Backend Setup (FastAPI)

Open a **Windows PowerShell** terminal:

```powershell
# Navigate to the backend folder
cd C:\Users\Geethika\smartreturn-ai\backend

# Create a Python virtual environment (.venv)
python -m venv .venv

# Activate the virtual environment
.\.venv\Scripts\Activate.ps1

# Install dependencies
pip install -r requirements.txt

# Create .env from template
Copy-Item .env.example .env

# Configure your GEMINI_API_KEY in backend/.env:
# GEMINI_API_KEY=your_actual_gemini_api_key_here

# Run FastAPI backend with Uvicorn
uvicorn main:app --reload --port 8000
```

> The backend will be live at `http://localhost:8000`. You can verify by opening `http://localhost:8000/health` in your browser.

---

### 3. Frontend Setup (React + Vite + Tailwind v4)

Open a second **Windows PowerShell** terminal:

```powershell
# Navigate to the frontend directory
cd C:\Users\Geethika\smartreturn-ai\frontend

# Install dependencies
npm install

# Create .env from template
Copy-Item .env.example .env
```

Now open `frontend/.env` in your editor and enter your Supabase credentials:

```env
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=your-actual-anon-key-here
VITE_API_URL=http://localhost:8000
```

Start the Vite development server:

```powershell
npm run dev
```

> The frontend will launch at `http://localhost:5173`.

---

## 🔒 Security & Implementation Details

- **Row Level Security (RLS)**: No user can access or mutate another user's purchases, returns, reminders, or invoice storage files.
- **Zero Service Role Exposure**: The client application only consumes the public anon key.
- **Client-Side Date Calculation**: Date windows (7 days, 14 days) are generated using JavaScript `toISOString().slice(0, 10)` and filtered with `.gte()` and `.lte()` without SQL interval syntax.
- **Backend Status Health Badge**: The top navigation bar polls the FastAPI `/health` endpoint and shows real-time online/offline indicators.
