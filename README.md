# YouTube Scrapper App

A full-stack application for scraping YouTube channel and video data. Works on Web and Android.

## Tech Stack
-   **Frontend**: React (Vite), Capacitor (for Mobile)
-   **Backend**: Python (FastAPI), SQLite
-   **Icons**: Lucide React
-   **Design**: Modern Dark UI

## Prerequisites
-   Node.js (v18+)
-   Python 3.10+
-   YouTube Data API Key ([Get one here](https://console.cloud.google.com/apis/library/youtube.googleapis.com))

## Setup Instructions

### 1. Backend Setup
1.  Navigate to `backend/`
2.  Install dependencies:
    ```bash
    pip install -r requirements.txt
    ```
3.  Create a `.env` file based on `.env.example` and add your `YOUTUBE_API_KEY`.
4.  Run the server:
    ```bash
    python main.py
    ```
    The API will be available at `http://localhost:8000`.

### 2. Frontend Setup
1.  Navigate to `frontend/`
2.  Install dependencies:
    ```bash
    npm install
    ```
3.  Run for web:
    ```bash
    npm run dev
    ```

### 3. Mobile (Android) Setup
1.  Build the web project:
    ```bash
    npm run build
    ```
2.  Sync with Capacitor:
    ```bash
    npx cap sync
    ```
3.  Open in Android Studio:
    ```bash
    npx cap open android
    ```

## Features
-   **Channel Scraping**: Get name, description, subscriber count, total views, total videos, location, and more.
-   **Video Scraping**: Automatically fetches the latest 10 videos including titles, views, likes, and comments.
-   **Responsive Design**: Premium dark mode UI that adapts to mobile and desktop screens.
-   **Offline Data**: All scraped data is saved in a local SQLite database.

last push 15-jan-26 
last push 16-jan-26 

