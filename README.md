# 🚀 Taskello – Trello Clone Project

Taskello is a full-stack task management web application inspired by Trello. It allows users to create boards, manage tasks, and organize workflows efficiently.

---

## 🧠 Features

- 📌 Create and manage boards  
- 📝 Add, update, and delete tasks/cards  
- 🔍 Search functionality for quick navigation  
- ⚡ Responsive and clean UI  
- 🔗 REST API integration between frontend and backend  

---

## 🛠️ Tech Stack

### Frontend:
- React.js  
- HTML  
- CSS  
- JavaScript  

### Backend:
- Node.js  
- Express.js  

### Database:
- SQLite (better-sqlite3)  

---

## 📂 Project Structure
taskello/
├── client/                # React frontend
│   ├── public/            # Static assets (HTML, favicon, etc.)
│   ├── src/               # React source code
│   │   ├── components/    # Reusable UI components (Buttons, Inputs, Cards)
│   │   ├── pages/         # Page-level components (Dashboard, Login, Home)
│   │   ├── App.js         # Main App component & Routing
│   │   ├── index.js       # React entry point
│   │   └── styles/        # Global and component-specific CSS
│   └── package.json       # Frontend dependencies and scripts
│
├── server/                # Node.js backend
│   ├── server.js          # Express server entry point
│   ├── routes/            # API endpoints and route logic
│   ├── db/                # Database connection and models
│   └── package.json       # Backend dependencies and scripts
│
├── .gitignore             # Files to exclude from Git (node_modules, .env)
└── README.md              # Project documentation

---

## ⚙️ Installation & Setup

### 1️⃣ Clone the repository

```bash
git clone https://github.com/YOUR_USERNAME/taskello.git
cd taskello


