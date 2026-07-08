# 🏥 District Health Centre Platform

An AI-powered, open-access healthcare management platform that provides a **real-time, district-wide view of hospital resources** including medicine stock, doctor availability, bed occupancy, diagnostic tests, and patient footfall. The platform helps patients find available healthcare resources while enabling district administrators to monitor and optimize Primary Health Centres (PHCs) and Community Health Centres (CHCs).

---

## 🌐 Live Demo

| Service | Link |
|---------|------|
| 🏠 Frontend | https://health-centre-frontend.onrender.com |
| ⚙️ Backend API | https://health-centre-backend-zzwq.onrender.com |

---

## 🚀 Features

### 💊 Medicine Stock Monitoring
- View real-time medicine availability across hospitals.
- Track stock levels to reduce medicine shortages.
- AI-based early stock-out warnings.

### 👨‍⚕️ Doctor Availability
- Browse doctor profiles.
- View specialization and assigned hospitals.
- Track doctor attendance.

### 🛏️ Bed Availability
- Monitor available hospital beds in real time.
- Helps patients locate nearby hospitals with vacant beds.

### 🧪 Diagnostic Test Availability
- Check available laboratory tests before visiting a hospital.

### 📊 District Dashboard
- Centralized dashboard for district administrators.
- Monitor medicines, doctors, beds, patient footfall, and tests.

### 📈 AI Demand Forecasting
- Predict future medicine demand.
- Generate smart inventory recommendations.

### 🔔 Smart Alerts
- Notify administrators about:
  - Low medicine stock
  - Resource shortages
  - Underperforming health centres

### 🌍 Multilingual Support
- User-friendly interface supporting multiple languages.

### 🔓 Open Access
- Patients can access hospital information without creating an account.

---

# 🏗️ System Architecture

```
                     Users
                        │
                        ▼
           React Frontend Application
                        │
                        ▼
             Express.js REST API
                        │
                        ▼
                 Node.js Backend
                        │
                        ▼
                 MongoDB Database
                        │
                        ▼
             AI Analytics Engine
                        │
                        ▼
      Dashboard & District Administrator
```

---

# ⚙️ Workflow

```
User Opens Platform
        │
        ▼
Selects District / Hospital
        │
        ▼
Views Medicine, Doctors,
Beds, Tests & Analytics
        │
        ▼
Frontend Requests Backend API
        │
        ▼
Backend Retrieves Data
from MongoDB
        │
        ▼
AI Generates Forecasts
        │
        ▼
Dashboard Displays
Real-Time Information
```

---

# 🛠️ Tech Stack

| Category | Technologies |
|----------|--------------|
| Frontend | React.js, HTML5, CSS3, JavaScript |
| Backend | Node.js, Express.js |
| Database | MongoDB (Mongoose) |
| AI & Analytics | Machine Learning, Predictive Analytics |
| Deployment | Render |
| Version Control | Git & GitHub |

---

# 📦 Installation

## 1️⃣ Clone Repository

```bash
git clone https://github.com/sahithya2105/health-centre-platform.git

cd health-centre-platform
```

---

## 2️⃣ Install Backend

```bash
cd backend
npm install
```

---

## 3️⃣ Install Frontend

```bash
cd frontend
npm install
```

---

## 4️⃣ Environment Variables

### backend/.env

```env
PORT=5000
MONGODB_URI=your_mongodb_connection_string
```

### frontend/.env

```env
REACT_APP_API_URL=http://localhost:5000
```

---

## 5️⃣ Start Backend

```bash
cd backend
npm start
```

---

## 6️⃣ Start Frontend

```bash
cd frontend
npm start
```

---

## 7️⃣ Open Browser

```
http://localhost:3000
```

---

# 📁 Project Structure

```
health-centre-platform/

│── frontend/
│   ├── public/
│   ├── src/
│   │   ├── components/
│   │   ├── pages/
│   │   ├── services/
│   │   ├── utils/
│   │   ├── App.jsx
│   │   └── index.js
│   └── package.json
│
│── backend/
│   ├── config/
│   ├── controllers/
│   ├── middleware/
│   ├── models/
│   ├── routes/
│   ├── server.js
│   └── package.json
│
├── README.md
├── package.json
├── package-lock.json
└── .gitignore
```

> **Note:** Update the project structure if your folders differ.

---

# ☁️ Deployment

Fully deployed on **Render**.

| Service | Type | URL |
|---------|------|-----|
| Frontend | Static Site | https://health-centre-frontend.onrender.com |
| Backend | Web Service | https://health-centre-backend-zzwq.onrender.com |

---

# 🔐 Environment Variables

## Frontend

| Key | Value |
|------|-------|
| REACT_APP_API_URL | https://health-centre-backend-zzwq.onrender.com |

## Backend

| Key | Value |
|------|-------|
| PORT | 10000 |
| MONGODB_URI | MongoDB Connection String |

---

# 🎯 Project Objectives

- Digitize PHC and CHC resource management.
- Reduce medicine stock-outs.
- Improve healthcare transparency.
- Enable data-driven decision making.
- Optimize healthcare resource distribution.
- Support district-level healthcare administration.

---

# 🌟 Key Benefits

- Real-time monitoring
- AI-based forecasting
- Faster resource allocation
- Improved patient experience
- Better healthcare planning
- Reduced medicine shortages
- Centralized administration
- Scalable architecture

---

# ⚠️ Known Limitations

- Free-tier Render backend sleeps after inactivity (first request may take ~50 seconds).
- Public data visibility due to no authentication.
- AI forecasting can be enhanced with larger datasets.

---

# 🔮 Future Improvements

- Hospital Admin Login
- Role-Based Authentication
- Real-Time Notifications
- AI Chatbot
- Voice Assistant
- Mobile Application
- Progressive Web App (PWA)
- IoT Integration
- GPS-Based Ambulance Tracking
- Disease Outbreak Prediction
- Smart Resource Redistribution
- Advanced Analytics Dashboard

---

# 🎯 Project Goal

To build a smart, AI-powered healthcare platform that enables patients and district administrators to instantly access real-time information about medicine availability, doctors, beds, and diagnostic services—reducing unnecessary travel, improving resource utilization, and enhancing healthcare delivery across PHCs and CHCs.

---

# 👩‍💻 Developer

**K. Sahithya**

**GitHub:** https://github.com/sahithya2105

**Live Project:** https://health-centre-frontend.onrender.com

---

# ⭐ If you found this project useful, don't forget to Star the repository!
