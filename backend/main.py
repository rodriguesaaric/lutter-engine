from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.responses import PlainTextResponse, Response
from fastapi.middleware.cors import CORSMiddleware
import uvicorn
import numpy as np
import cv2

app = FastAPI(title="Lutter Brain API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # Dynamically allows requests from any production Frontend (Vercel/Netlify)
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

def bytes_to_rgb(img_bytes: bytes) -> np.ndarray:
    nparr = np.frombuffer(img_bytes, np.uint8)
    bgr_img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
    return cv2.cvtColor(bgr_img, cv2.COLOR_BGR2RGB)

def apply_color_transform(target_rgb: np.ndarray, scene_rgb: np.ndarray, ref_rgb: np.ndarray, hueShift: float, saturation: float, luminance: float, intensity: float, skinSensitivity: float):
    # RESTORE INITIAL ACCURATE UINT8 LIMITS MATHEMATICALLY
    target_rgb = target_rgb.astype(np.uint8)
    scene_rgb = scene_rgb.astype(np.uint8)
    ref_rgb = ref_rgb.astype(np.uint8)

    ref_lab = cv2.cvtColor(ref_rgb, cv2.COLOR_RGB2LAB).astype(np.float32)
    scene_lab = cv2.cvtColor(scene_rgb, cv2.COLOR_RGB2LAB).astype(np.float32)
    target_lab = cv2.cvtColor(target_rgb, cv2.COLOR_RGB2LAB).astype(np.float32)
    
    (lMeanSrc, lStdSrc) = (np.mean(scene_lab[:,:,0]), np.std(scene_lab[:,:,0]))
    (aMeanSrc, aStdSrc) = (np.mean(scene_lab[:,:,1]), np.std(scene_lab[:,:,1]))
    (bMeanSrc, bStdSrc) = (np.mean(scene_lab[:,:,2]), np.std(scene_lab[:,:,2]))

    (lMeanTar, lStdTar) = (np.mean(ref_lab[:,:,0]), np.std(ref_lab[:,:,0]))
    (aMeanTar, aStdTar) = (np.mean(ref_lab[:,:,1]), np.std(ref_lab[:,:,1]))
    (bMeanTar, bStdTar) = (np.mean(ref_lab[:,:,2]), np.std(ref_lab[:,:,2]))

    # Advanced Dynamic Reinhard: Limits extreme contrast tearing but expands bounds adequately to match reference punch.
    l_ratio = np.clip(lStdTar / (lStdSrc + 1e-5), 0.4, 2.5)
    a_ratio = np.clip(aStdTar / (aStdSrc + 1e-5), 0.4, 2.5)
    b_ratio = np.clip(bStdTar / (bStdSrc + 1e-5), 0.4, 2.5)

    # Calculate base Reinhard Transfer (Incorporating Luminance contrast strictly to align to reference styles)
    l_chan = ((target_lab[:,:,0] - lMeanSrc) * l_ratio) + lMeanTar
    a_chan = ((target_lab[:,:,1] - aMeanSrc) * a_ratio) + aMeanTar
    b_chan = ((target_lab[:,:,2] - bMeanSrc) * b_ratio) + bMeanTar

    # Apply LUMINANCE Slider (Scale -100 to 100 correctly across 0-255 bounds offset)
    l_chan = l_chan + (luminance * 1.27) 

    # Apply EXACT SATURATION Vector Scaling geometrically away from true neutral CIELAB pole (128.0)
    if saturation != 0.0:
        sat_scale = 1.0 + (saturation / 100.0)
        a_chan = 128.0 + ((a_chan - 128.0) * sat_scale) 
        b_chan = 128.0 + ((b_chan - 128.0) * sat_scale)

    # Apply HUE SHIFT via pure trigonometric rotation matrix inside CIELAB channels perfectly cleanly avoiding HSV hacks
    if hueShift != 0.0:
        angle = np.radians(hueShift)
        a_center = a_chan - 128.0
        b_center = b_chan - 128.0
        a_chan = 128.0 + (a_center * np.cos(angle) - b_center * np.sin(angle))
        b_chan = 128.0 + (a_center * np.sin(angle) + b_center * np.cos(angle))

    l_chan = np.clip(l_chan, 0, 255)
    a_chan = np.clip(a_chan, 0, 255)
    b_chan = np.clip(b_chan, 0, 255)

    transfer_lab = cv2.merge([l_chan, a_chan, b_chan]).astype(np.uint8)
    transfer_rgb = cv2.cvtColor(transfer_lab, cv2.COLOR_LAB2RGB).astype(np.float32)

    # Exact standard uintYCrCb scaling to utilize original hard boundaries securely
    target_ycrcb = cv2.cvtColor(target_rgb.astype(np.uint8), cv2.COLOR_RGB2YCrCb)
    Cr = target_ycrcb[:,:,1].astype(np.float32)
    Cb = target_ycrcb[:,:,2].astype(np.float32)
    
    skin_mask = (Cr >= 133) & (Cr <= 173) & (Cb >= 77) & (Cb <= 127)
    protection_ratio = skinSensitivity / 100.0
    
    alpha = np.zeros(target_rgb.shape[:2], dtype=np.float32)
    alpha[skin_mask] = protection_ratio
    alpha_3d = np.expand_dims(alpha, axis=2)
    
    protected_rgb = (target_rgb.astype(np.float32) * alpha_3d) + (transfer_rgb * (1.0 - alpha_3d))

    intensity_ratio = intensity / 100.0
    final_rgb = (target_rgb.astype(np.float32) * (1.0 - intensity_ratio)) + (protected_rgb * intensity_ratio)
        
    return np.clip(final_rgb, 0, 255).astype(np.uint8)


@app.post("/api/preview")
async def generate_preview(
    reference: UploadFile = File(...),
    scene1: UploadFile = File(...),
    hueShift: float = Form(0.0),
    saturation: float = Form(0.0),
    luminance: float = Form(0.0),
    intensity: float = Form(100.0),
    skinSensitivity: float = Form(50.0)
):
    ref_bytes = await reference.read()
    scene1_bytes = await scene1.read()
    
    ref_rgb = bytes_to_rgb(ref_bytes)
    scene_rgb = bytes_to_rgb(scene1_bytes)

    if ref_rgb is None or scene_rgb is None:
        raise HTTPException(status_code=400, detail="Invalid target blocks")
        
    # FIX: "Not updating completely" -> High resolution RAW images natively lock up Backend resources in Preview mode blocking the Debouncer updates.
    # Instantly bounding matrix arrays cleanly resolves React front-end sync lag globally.
    max_dim = 1280
    h_s, w_s = scene_rgb.shape[:2]
    if max(h_s, w_s) > max_dim:
        scale_s = max_dim / float(max(h_s, w_s))
        scene_rgb = cv2.resize(scene_rgb, (int(w_s * scale_s), int(h_s * scale_s)), interpolation=cv2.INTER_AREA)

    h_r, w_r = ref_rgb.shape[:2]
    if max(h_r, w_r) > max_dim:
        scale_r = max_dim / float(max(h_r, w_r))
        ref_rgb = cv2.resize(ref_rgb, (int(w_r * scale_r), int(h_r * scale_r)), interpolation=cv2.INTER_AREA)

    transfer_rgb = apply_color_transform(scene_rgb, scene_rgb, ref_rgb, hueShift, saturation, luminance, intensity, skinSensitivity)
    
    # Internal BGR repacking allows imencode API functionality seamlessly. High-quality jpg map avoids visual shifts.
    preview_bgr = cv2.cvtColor(transfer_rgb, cv2.COLOR_RGB2BGR)
    success, encoded_image = cv2.imencode('.jpg', preview_bgr, [int(cv2.IMWRITE_JPEG_QUALITY), 95])
    return Response(content=encoded_image.tobytes(), media_type="image/jpeg")


@app.post("/api/generate-lut")
async def generate_lut(
    reference: UploadFile = File(...),
    scene1: UploadFile = File(...),
    scene2: UploadFile = None,
    scene3: UploadFile = None,
    hueShift: float = Form(0.0),
    saturation: float = Form(0.0),
    luminance: float = Form(0.0),
    intensity: float = Form(100.0),
    skinSensitivity: float = Form(50.0)
):
    try:
        ref_bytes = await reference.read()
        scene1_bytes = await scene1.read()
        
        ref_rgb = bytes_to_rgb(ref_bytes)
        scene_rgb = bytes_to_rgb(scene1_bytes)

        if ref_rgb is None or scene_rgb is None:
            raise ValueError()
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid structure parsing")

    # DO NOT scale original images here explicitly to permit absolute original map variance analysis mapping properly
    grid = []
    
    for b in range(33):
        for g in range(33):
            for r in range(33):
                grid.append([(r / 32.0) * 255.0, (g / 32.0) * 255.0, (b / 32.0) * 255.0])
                
    grid = np.array(grid, dtype="uint8").reshape(-1, 1, 3)
    
    grid_transformed = apply_color_transform(grid, scene_rgb, ref_rgb, hueShift, saturation, luminance, intensity, skinSensitivity)

    transfer_rgb = grid_transformed.astype("float32")
    transfer_rgb /= 255.0
    
    transfer_rgb = np.clip(transfer_rgb, 0.0, 1.0)

    def format_val(v):
        s = f"{v:.6f}"
        if s == "0.000000": return "0"
        if s == "1.000000": return "1"
        return s

    lines = [
        'TITLE "Lutter_Grade"',
        'LUT_3D_SIZE 33'
    ]
    
    for val in transfer_rgb:
        r_val, g_val, b_val = val[0]
        lines.append(f"{format_val(r_val)} {format_val(g_val)} {format_val(b_val)}")

    return PlainTextResponse(content="\n".join(lines), media_type="text/plain")

if __name__ == "__main__":
    uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=True)
