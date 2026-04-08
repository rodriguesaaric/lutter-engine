# Lutter Engine — Cinematic Color Transfer & 3D LUT Generator

Lutter is a full-stack color grading and computer vision application engineered to perform high-precision statistical color matching between visual reference targets and raw/log footage. It strictly exports production-ready `.cube` lookup tables formatted exactly for modern cinematic pipelines.

![Lutter Preview Interface](public/favicon.svg) <!-- Replace with an actual screenshot of the UI -->

## 🚀 Features

* **Float32 CIELAB Engine**: Completely bypasses typical 8-bit integer truncation errors native to most OpenCV pipelines, preventing neutral-shadow color casts by generating trigonometric distance variables along true geometric axes natively around `128` (Perfect Neutral Gray).
* **Advanced Reinhard Statistical Mapping**: Employs mathematical dynamic Standard Deviation and Mean mapping algorithms. Transfers both the exact Chrominance palettes and the precise contrast Luminance punch to match varying scene styles flawlessly without washing out pixels.
* **YCrCb Skin Gating**: Incorporates a specialized internal mask boundary isolation targeting exact facial tone limits (`Cr: 133-173`, `Cb: 77-127`) governed tightly by an alpha protection ratio slider explicitly isolating talent skin from aggressive background transfers.
* **Adobe Premiere/Resolve Secure Matrices**: The 33x33x33 3D `.cube` generating loops are explicitly governed dynamically by the `Red-Inner/Blue-Outer` architectural constraints directly satisfying DaVinci Resolve and Adobe Premiere parsing limits (defeating standard R/B geometric smurf-swapping bugs).
* **Vector Slider Interventions**: Mathematical scaling of distance limits purely via `sin()` and `cos()` trigonometric rotation inside CIELAB channels, fully nullifying clipping boundaries during extreme Saturation and Hue modifications.
* **Live Debounced React Previews**: A dual-layered Vite/React preview component executing asynchronous Blob generation, dynamically constrained within 1280px backend API rendering blocks, permitting zero-latency pipeline live scrubbing on top of raw 45MP footage inputs.

## 🛠️ Stack

* **Frontend**: React, Vite, Vanilla CSS.
* **Backend**: Python, FastAPI, OpenCV, NumPy.
* **Hosting Configuration**: Configured natively for split Vercel (Front) + Render/Railway (Backend) deployment matrices via dynamic environment variables.

## ⚙️ Running Locally

### 1. The Python Brain (Backend)
Open a terminal, activate your virtual environment, and boot the FastAPI Uvicorn engine:
```bash
cd backend
pip install -r requirements.txt
python main.py
```
*Runs locally on `http://127.0.0.1:8000`*

### 2. The React UI (Frontend)
Open a separate terminal in the root directory:
```bash
npm install
npm run dev
```
*Runs locally on `http://localhost:5173`*

## 🌐 Production Deployment
The React application dynamically switches its endpoint API polling when hosted via CI/CD. 
Ensure you define your `VITE_API_URL` environment variable within your specific cloud platform settings (e.g. Vercel) pointing strictly to the live production Python URL endpoints.

## 📝 Author
Aaric Rodrigues
