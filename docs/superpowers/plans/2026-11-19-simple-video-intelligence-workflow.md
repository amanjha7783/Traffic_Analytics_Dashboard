# Implementation Plan: TrafficOps Simple Video Intelligence Workflow

**Date:** 2026-11-19
**Target:** TrafficOps Enterprise Transportation Intelligence Platform
**Goal:** Deliver the simple, focused Video Intelligence feature with full frontend + backend functionality, distinct URLs for every feature/page via `react-router-dom`, adhering strictly to the user's specification and restrictions.

---

## 1. Architecture & Routing Design

### 1.1 Sidebar
- Exactly ONE primary sidebar item: **Video Intelligence** (`/video-intelligence`).
- No separate sub-items for projects, uploads, history, or analytics in the sidebar.
- Preserves all 8 existing TrafficOps modules.

### 1.2 Distinct URLs for Every Page
- `/video-intelligence` -> **Project Listing Page**
- `/video-intelligence/projects/:projectId` -> **Project Workspace** (ONLY upload area + History button)
- `/video-intelligence/projects/:projectId/history` -> **History Page** (Project video records table)
- `/video-intelligence/projects/:projectId/videos/:videoId/setup` -> **Video Setup Page** (First-frame + 4 GCPs + Lat/Lon inputs + Homography validation + Final Submit)
- `/video-intelligence/projects/:projectId/videos/:videoId/processing/:jobId` -> **Processing Status Page** (Real-time progress, auto-redirect to analytics)
- `/video-intelligence/projects/:projectId/videos/:videoId/analytics` -> **Individual Video Analytics Page** (Annotated player + Exactly 4 Graphs + Trajectory table with View/Seek)

---

## 2. Detailed Task Breakdown

### Task 1: Router Setup and Navigation Integration
- Wrap application with `BrowserRouter` in `main.tsx`.
- Refactor `App.tsx` to define route matching for all core tabs and the `/video-intelligence/*` route family.
- Update `Sidebar.tsx` and `Header.tsx` to handle route paths cleanly while preserving active tab indicators.

### Task 2: Project Listing Page (`/video-intelligence`) & Modal
- File: `frontend/src/pages/video-intelligence/ProjectListPage.tsx`
- Heading: "Video Intelligence Projects"
- Large prominent "Create New Project" button with icon.
- List existing projects: Name, Description, Created Date, "Open Project" button.
- Clean empty state if no projects exist.
- Modal with ONLY 2 fields:
  1. `Project Name` (Required)
  2. `Description` (Optional)
- Submitting saves via `POST /api/video-intelligence/projects` and navigates to `/video-intelligence/projects/:projectId`.

### Task 3: Project Workspace (`/video-intelligence/projects/:projectId`)
- File: `frontend/src/pages/video-intelligence/SimpleProjectWorkspace.tsx`
- Shows ONLY:
  - Project name.
  - A large drag-and-drop video upload area.
  - "Select Video" button.
  - "History" button on the right side.
- Supports MP4, MOV, AVI, MKV with validation and progress bar.
- Shows selected filename and status.
- User clicks "Submit", uploads to backend `POST /projects/:projectId/videos/upload`, and redirects to `/video-intelligence/projects/:projectId/videos/:videoId/setup`.

### Task 4: Video Setup Page (`/video-intelligence/projects/:projectId/videos/:videoId/setup`)
- File: `frontend/src/pages/video-intelligence/VideoSetupPage.tsx`
- A. Video name: Original filename + optional rename input.
- B. First-frame viewer: Loads extracted first frame from backend `/videos/:videoId/first-frame`.
- C. Calibration: Exactly 4 numbered ground-control points (Point 1, Point 2, Point 3, Point 4).
  - Click to place on image.
  - Drag to reposition.
  - Google Earth-style pan and zoom (+, -, reset view).
  - Preserves original image pixel scale regardless of zoom/pan.
- D. Coordinates: Beside image, 4 point configuration sections (Point 1, Point 2, Point 3, Point 4):
  - Latitude input.
  - Longitude input.
  - Image X & Image Y (auto-updating on drag/click).
- E. Calibration validation:
  - Computes homography matrix via backend `POST /videos/:videoId/calibration`.
  - Calculates reprojection RMSE and validates distribution.
  - Displays calibration status.
- F. Final Submit:
  - Updates video name if renamed.
  - Saves calibration points and homography matrix.
  - Starts backend processing `POST /videos/:videoId/process`.
  - Redirects to `/video-intelligence/projects/:projectId/videos/:videoId/processing/:jobId`.

### Task 5: Processing Monitor (`/video-intelligence/projects/:projectId/videos/:videoId/processing/:jobId`)
- File: `frontend/src/pages/video-intelligence/VideoProcessingPage.tsx`
- Connects to backend `GET /api/video-intelligence/jobs/:jobId`.
- Real-time progress bar, completed frames, total frames, processing FPS, stage.
- Cancel and retry controls.
- Automatically redirects to `/video-intelligence/projects/:projectId/videos/:videoId/analytics` when job status is `COMPLETED`.

### Task 6: Individual Video Analytics Page (`/video-intelligence/projects/:projectId/videos/:videoId/analytics`)
- File: `frontend/src/pages/video-intelligence/SimpleVideoAnalyticsPage.tsx`
- A. Annotated Video:
  - Large video player.
  - Play/pause, seeking, current time/duration.
  - Download Annotated MP4 button.
- B. Exactly Four Graphs:
  1. Vehicle Count Over Time (X: Time, Y: Vehicle Count)
  2. Average Vehicle Speed (X: Time, Y: Speed in km/h)
  3. Traffic Density (X: Time, Y: Vehicles per unit area)
  4. Vehicle Classification (Vehicle class distribution)
- C. Trajectory Table:
  - Columns: Timestamp, Track ID, Vehicle Class, Image X, Image Y, Ground X (m), Ground Y (m), Latitude, Longitude, Speed (km/h), Action (View button).
  - When "View" is clicked:
    - Seeks annotated video to that exact timestamp.
    - Highlights that tracking ID.
  - Pagination, sorting, CSV download.

### Task 7: Project History Page (`/video-intelligence/projects/:projectId/history`)
- File: `frontend/src/pages/video-intelligence/ProjectHistoryPage.tsx`
- Table of all videos for the project:
  - Video name
  - Upload date
  - Processing status
  - Download Annotated Video button (if completed)
  - Download CSV button (if completed)
  - Open Analytics button (navigates to analytics page)
  - Delete button (with confirmation)
  - Retry button (if failed)

### Task 8: Verification & User Journey Test
- Build with `npm run build` and `npm run lint` (0 errors).
- Verify the complete 23-step user journey.
