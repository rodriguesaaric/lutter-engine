import React, { useState, useRef, useEffect } from 'react';
import './index.css';

function App() {
  const [hsl, setHsl] = useState({ hueShift: 0, saturation: 0, luminance: 0, intensity: 100 });
  const [skinSensitivity, setSkinSensitivity] = useState(50);
  
  const [scenes, setScenes] = useState([]);
  const [reference, setReference] = useState(null);
  
  const [activeSceneIndex, setActiveSceneIndex] = useState(0);
  const [processedImageUrl, setProcessedImageUrl] = useState(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);

  const activeSceneUrl = scenes[activeSceneIndex]?.url;
  const activeSceneFile = scenes[activeSceneIndex]?.file;

  const canGenerate = scenes.length > 0 && reference !== null;

  useEffect(() => {
    if (scenes.length === 0) {
      setActiveSceneIndex(0);
    } else if (activeSceneIndex >= scenes.length) {
      setActiveSceneIndex(scenes.length - 1);
    }
  }, [scenes, activeSceneIndex]);

  // Debounced API Preview call
  useEffect(() => {
    if (!canGenerate || !activeSceneFile || !reference?.file) {
      setProcessedImageUrl(null);
      return;
    }

    const abortController = new AbortController();

    const fetchPreview = async () => {
      setIsPreviewLoading(true);
      try {
        const formData = new FormData();
        formData.append('reference', reference.file);
        formData.append('scene1', activeSceneFile);
        formData.append('hueShift', hsl.hueShift.toString());
        formData.append('saturation', hsl.saturation.toString());
        formData.append('luminance', hsl.luminance.toString());
        formData.append('intensity', hsl.intensity.toString());
        formData.append('skinSensitivity', skinSensitivity.toString());

        const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000';
        const res = await fetch(`${API_BASE_URL}/api/preview`, {
          method: 'POST',
          body: formData,
          signal: abortController.signal
        });

        if (!res.ok) throw new Error("Preview failed");
        
        const blob = await res.blob();
        const objectUrl = URL.createObjectURL(blob);
        setProcessedImageUrl(objectUrl);
      } catch (err) {
        if (err.name !== 'AbortError') {
          console.error("Preview fetch err:", err);
        }
      } finally {
        setIsPreviewLoading(false);
      }
    };

    const timeoutId = setTimeout(() => {
      fetchPreview();
    }, 400);

    return () => {
      clearTimeout(timeoutId);
      abortController.abort();
    };
  }, [canGenerate, activeSceneFile, reference, hsl, skinSensitivity]);

  const handleSceneUpload = (data) => {
    setScenes((prev) => {
      const newScenes = [...prev, data];
      setActiveSceneIndex(newScenes.length - 1);
      return newScenes;
    });
  };

  const handleRemoveScene = (idToRemove) => {
    setScenes((prev) => prev.filter((scene) => scene.id !== idToRemove));
  };

  const handleGenerate = async () => {
    setIsGenerating(true);
    console.log('Sending generated logic payload...');
    try {
      const formData = new FormData();
      if (reference?.file) formData.append('reference', reference.file);
      if (scenes[0]?.file) formData.append('scene1', scenes[0].file);
      if (scenes[1]?.file) formData.append('scene2', scenes[1].file);
      if (scenes[2]?.file) formData.append('scene3', scenes[2].file);
      
      formData.append('hueShift', hsl.hueShift.toString());
      formData.append('saturation', hsl.saturation.toString());
      formData.append('luminance', hsl.luminance.toString());
      formData.append('intensity', hsl.intensity.toString());
      formData.append('skinSensitivity', skinSensitivity.toString());

      const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000';
      const response = await fetch(`${API_BASE_URL}/api/generate-lut`, {
        method: 'POST',
        body: formData
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const result = await response.text();
      
      const blob = new Blob([result], { type: 'text/plain' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'Lutter_Output.cube';
      a.click();

      console.log('Success - .cube exported payload:', result.substring(0, 50) + '...');
    } catch (error) {
      console.error('Request failed:', error);
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="app-container" style={{ padding: '2rem', maxWidth: '1280px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      <header style={{ paddingBottom: '1rem', borderBottom: '1px solid rgba(65, 71, 84, 0.15)' }}>
        <h1 style={{ fontSize: '2.5rem', fontWeight: '700', letterSpacing: '-0.02em', color: 'var(--primary)' }}>LUTTER</h1>
        <p className="technical-label" style={{ color: 'var(--on-surface-variant)', marginTop: '0.25rem' }}>Kinetic Instrument / .CUBE Generator</p>
      </header>

      <main className="main-layout">
        
        <section style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
          
          <div className="surface-low" style={{ padding: '2rem' }}>
            <h2 style={{ fontSize: '1.25rem', color: 'var(--on-surface)', marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between' }}>
              Interactive Preview
              {activeSceneUrl && (
                <span className="technical-label" style={{ color: isPreviewLoading ? 'var(--outline)' : 'var(--primary)', transition: 'color 0.2s ease' }}>
                  {isPreviewLoading ? 'CALCULATING...' : 'LIVE'}
                </span>
              )}
            </h2>
            <InteractivePreview rawSrc={activeSceneUrl} processedSrc={processedImageUrl} />
          </div>

          <div className="surface-low" style={{ padding: '2rem' }}>
            <h2 style={{ fontSize: '1.25rem', color: 'var(--on-surface)', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              Scene Calibration
              <span className="technical-label" style={{ color: 'var(--primary-container)', fontSize: '0.75rem' }}>MIN. 1 SCENE REQUIRED</span>
            </h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1.5rem', minHeight: '180px' }}>
              {scenes.map((scene, index) => (
                <UploadSlot 
                  key={scene.id} 
                  label={`SCENE ${index + 1}`} 
                  fileUrl={scene.url} 
                  isActive={index === activeSceneIndex}
                  onMakeActive={() => setActiveSceneIndex(index)}
                  onRemove={() => handleRemoveScene(scene.id)}
                />
              ))}
              {scenes.length < 3 && (
                <UploadSlot 
                  label={`SCENE ${scenes.length + 1}`} 
                  onUpload={handleSceneUpload} 
                />
              )}
            </div>
          </div>

          <div className="surface-low" style={{ padding: '2rem' }}>
            <h2 style={{ fontSize: '1.25rem', color: 'var(--on-surface)', marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between' }}>
              Reference Target
            </h2>
            <ReferenceSlot 
              fileUrl={reference?.url} 
              onUpload={(data) => setReference(data)} 
            />
          </div>
        </section>

        <aside className="glass-panel ghost-border parameters-aside" style={{ padding: '2rem', borderRadius: '0.75rem' }}>
          <h2 style={{ fontSize: '1.25rem', color: 'var(--on-surface)', marginBottom: '2rem' }}>Parameters</h2>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              <SliderControl label="HUE SHIFT" value={hsl.hueShift} min={-180} max={180} defaultVal={0} unit="°" onChange={(v) => setHsl({...hsl, hueShift: v})} />
              <SliderControl label="SATURATION" value={hsl.saturation} min={-100} max={100} defaultVal={0} unit="%" onChange={(v) => setHsl({...hsl, saturation: v})} />
              <SliderControl label="LUMINANCE" value={hsl.luminance} min={-100} max={100} defaultVal={0} unit="%" onChange={(v) => setHsl({...hsl, luminance: v})} />
              <SliderControl label="INTENSITY" value={hsl.intensity} min={0} max={100} defaultVal={100} unit="%" onChange={(v) => setHsl({...hsl, intensity: v})} />
            </div>

            <div style={{ height: '1px', backgroundColor: 'rgba(65, 71, 84, 0.15)', margin: '0.5rem 0' }}></div>

            <SliderControl label="SKIN SENSITIVITY" value={skinSensitivity} min={0} max={100} defaultVal={50} unit="%" onChange={setSkinSensitivity} highlight />
          </div>

          <div style={{ marginTop: '3rem' }}>
            <button 
              disabled={!canGenerate || isGenerating}
              onClick={handleGenerate}
              style={{ 
                width: '100%', 
                padding: '1rem', 
                borderRadius: '0.25rem', 
                border: 'none', 
                background: (canGenerate && !isGenerating) ? 'linear-gradient(135deg, var(--primary) 0%, var(--primary-container) 100%)' : 'var(--surface-container-high)',
                color: (canGenerate && !isGenerating) ? 'var(--on-primary)' : 'var(--outline)',
                fontFamily: 'var(--font-label)',
                fontWeight: '700',
                fontSize: '1rem',
                letterSpacing: '0.05em',
                cursor: (canGenerate && !isGenerating) ? 'pointer' : 'not-allowed',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.5rem',
                transition: 'all 0.2s ease'
              }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2v20"></path><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path></svg>
              {isGenerating ? 'PROCESSING...' : 'GENERATE .CUBE'}
            </button>
          </div>
        </aside>
      </main>
    </div>
  );
}

// Subcomponents

function InteractivePreview({ rawSrc, processedSrc }) {
  const [split, setSplit] = useState(50);
  
  return (
    <div 
      className="surface-high ghost-border"
      style={{ 
        width: '100%', 
        aspectRatio: '16/9', 
        position: 'relative', 
        borderRadius: '0.75rem',
        overflow: 'hidden',
        backgroundColor: '#1b1b1b',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}
    >
      {!rawSrc ? (
        <div style={{ color: 'var(--outline)', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" style={{ marginBottom: '1rem' }}><circle cx="12" cy="12" r="10"></circle><polygon points="10 8 16 12 10 16 10 8"></polygon></svg>
          <span className="technical-label">UPLOAD A SCENE TO PREVIEW</span>
        </div>
      ) : (
        <>
          {/* Base Layer: ALWAYS Processed (showing behind the Before image) */}
          <img 
            src={processedSrc || rawSrc} 
            alt="After" 
            style={{ 
              position: 'absolute', 
              inset: 0, 
              width: '100%', 
              maxWidth: '100%',
              height: '100%', 
              objectFit: 'cover'
            }} 
          />
          
          {/* Overlay Layer: ALWAYS Raw Original. 
              By clipping exactly X% from the right, the Left Side perfectly represents the overlaying Raw image. 
              If split is 50%, right 50% is cut away, revealing the backend Processed image below. */}
          <img 
             src={rawSrc} 
             alt="Before" 
             style={{ 
               position: 'absolute', 
               inset: 0, 
               width: '100%', 
               maxWidth: '100%',
               height: '100%', 
               objectFit: 'cover', 
               clipPath: `inset(0 ${100 - split}% 0 0)`
             }} 
          />

          <div style={{ position: 'absolute', top: 0, bottom: 0, left: `${split}%`, width: '2px', backgroundColor: 'var(--primary)', pointerEvents: 'none', transform: 'translateX(-50%)' }}>
            <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', width: '32px', height: '32px', backgroundColor: 'var(--surface-container-highest)', border: '2px solid var(--primary)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--primary)', boxShadow: '0 4px 12px rgba(0,0,0,0.5)' }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"></polyline></svg>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginLeft: '-6px' }}><polyline points="9 18 15 12 9 6"></polyline></svg>
            </div>
          </div>

          <input 
            type="range" 
            min="0" 
            max="100" 
            value={split} 
            onChange={(e) => setSplit(Number(e.target.value))}
            style={{ 
              position: 'absolute', 
              inset: 0, 
              width: '100%', 
              height: '100%', 
              opacity: 0, 
              cursor: 'col-resize',
              margin: 0
            }} 
          />
          
          <div style={{ position: 'absolute', bottom: '1rem', left: '1rem', display: 'flex', gap: '0.5rem', pointerEvents: 'none' }}>
            <span className="technical-label" style={{ backgroundColor: 'rgba(0,0,0,0.6)', padding: '4px 8px', borderRadius: '4px', color: 'white', backdropFilter: 'blur(4px)' }}>BEFORE (ORIGINAL)</span>
          </div>
          <div style={{ position: 'absolute', bottom: '1rem', right: '1rem', display: 'flex', gap: '0.5rem', pointerEvents: 'none' }}>
            <span className="technical-label" style={{ backgroundColor: 'var(--primary)', padding: '4px 8px', borderRadius: '4px', color: 'var(--on-primary)' }}>AFTER (BACKEND)</span>
          </div>
        </>
      )}
    </div>
  );
}

function UploadSlot({ label, fileUrl, isActive, onMakeActive, onRemove, onUpload }) {
  const fileInputRef = useRef(null);

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const url = URL.createObjectURL(file);
      onUpload({ id: Date.now() + Math.random(), file, url });
    }
  };

  const isFilled = !!fileUrl;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
      <label className="technical-label" style={{ color: isActive ? 'var(--primary)' : 'var(--on-surface-variant)', fontSize: '0.75rem', display: 'flex', justifyContent: 'space-between', transition: 'color 0.2s ease' }}>
        {label}
        {isFilled && <span style={{ color: isActive ? 'var(--primary)' : 'var(--outline)' }}>{isActive ? '• ACTIVE' : 'LOADED'}</span>}
      </label>
      <div 
        onClick={() => {
          if (isFilled && onMakeActive) {
            onMakeActive();
          } else if (!isFilled) {
            fileInputRef.current?.click();
          }
        }}
        className="surface-high ghost-border upload-slot"
        style={{ 
          aspectRatio: '1/1', 
          position: 'relative',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transition: 'all 0.2s ease',
          overflow: 'hidden',
          borderRadius: '0.75rem',
          boxShadow: isActive ? '0 0 0 2px var(--primary), 0 0 16px rgba(173, 199, 255, 0.15)' : 'none',
          border: isActive ? '1px solid transparent' : undefined
        }}
        onMouseOver={(e) => { 
          if (!isFilled) e.currentTarget.style.backgroundColor = 'var(--surface-bright)'; 
          else if (!isActive) e.currentTarget.querySelector('.remove-btn').style.opacity = '1';
        }}
        onMouseOut={(e) => { 
          if (!isFilled) e.currentTarget.style.backgroundColor = 'var(--surface-container-high)'; 
          else if (!isActive) e.currentTarget.querySelector('.remove-btn').style.opacity = '0';
        }}
      >
        {!isFilled && (
          <input 
            type="file" 
            ref={fileInputRef} 
            onChange={handleFileChange} 
            accept="image/*" 
            style={{ display: 'none' }} 
          />
        )}
        {isFilled ? (
          <>
            <img src={fileUrl} alt={label} style={{ width: '100%', maxWidth: '100%', height: '100%', objectFit: 'cover' }} />
            <button 
              className="remove-btn"
              onClick={(e) => {
                e.stopPropagation();
                onRemove();
              }}
              style={{
                position: 'absolute',
                top: '0.5rem',
                right: '0.5rem',
                background: 'rgba(0,0,0,0.6)',
                border: 'none',
                color: 'white',
                borderRadius: '50%',
                width: '24px',
                height: '24px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                backdropFilter: 'blur(4px)',
                opacity: isActive ? '1' : '0',
                transition: 'opacity 0.2s ease'
              }}
              title="Remove Scene"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
            </button>
          </>
        ) : (
          <div style={{ color: 'var(--outline)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem' }}>
             <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg>
             <span className="technical-label" style={{ fontSize: '0.65rem' }}>ADD SCENE</span>
          </div>
        )}
      </div>
    </div>
  );
}

function ReferenceSlot({ fileUrl, onUpload }) {
  const fileInputRef = useRef(null);

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const url = URL.createObjectURL(file);
      onUpload({ file, url });
    }
  };

  return (
    <div 
      onClick={() => fileInputRef.current?.click()}
      className="surface-high ghost-border upload-slot"
      style={{ 
        aspectRatio: '21/9', 
        position: 'relative',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        transition: 'all 0.2s ease',
        borderRadius: '0.75rem',
        overflow: 'hidden'
      }}
      onMouseOver={(e) => { if (!fileUrl) e.currentTarget.style.backgroundColor = 'var(--surface-bright)'; }}
      onMouseOut={(e) => { if (!fileUrl) e.currentTarget.style.backgroundColor = 'var(--surface-container-high)'; }}
    >
      <input 
        type="file" 
        ref={fileInputRef} 
        onChange={handleFileChange} 
        accept="image/*" 
        style={{ display: 'none' }} 
      />
      {fileUrl ? (
        <>
          <img src={fileUrl} alt="Reference" style={{ width: '100%', maxWidth: '100%', height: '100%', objectFit: 'cover' }} />
          <div style={{ position: 'absolute', top: '1rem', right: '1rem', pointerEvents: 'none' }}>
            <span className="technical-label" style={{ backgroundColor: 'rgba(0,0,0,0.5)', padding: '4px 8px', borderRadius: '4px', color: 'var(--tertiary)', backdropFilter: 'blur(4px)' }}>TARGET LOADED</span>
          </div>
        </>
      ) : (
        <div style={{ color: 'var(--outline)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem' }}>
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginBottom: '0.5rem' }}><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline></svg>
          <span className="technical-label">DROP REFERENCE IMAGE</span>
        </div>
      )}
    </div>
  );
}

function SliderControl({ label, value, min, max, unit, onChange, highlight, defaultVal }) {
  const labelColor = highlight ? 'var(--primary)' : 'var(--on-surface-variant)';
  const trackColor = highlight ? 'var(--primary)' : 'var(--outline)';

  const handleInputChange = (e) => {
    let val = e.target.value;
    if (val === '') {
      onChange(0); // Optional fallback if empty
      return;
    }
    onChange(Number(val));
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
           <label className="technical-label" style={{ color: labelColor, fontSize: '0.75rem' }}>{label}</label>
           <button 
             onClick={() => onChange(defaultVal)}
             title="Reset"
             style={{ 
               background: 'transparent', 
               border: 'none', 
               cursor: 'pointer', 
               color: 'var(--outline-variant)', 
               padding: 0,
               display: 'flex'
             }}
           >
             <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"></path><polyline points="3 3 3 8 8 8"></polyline></svg>
           </button>
        </div>
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <input 
            type="number" 
            value={value}
            onChange={handleInputChange}
            className="technical-label"
            style={{ 
              background: 'transparent', 
              border: 'none', 
              color: 'var(--on-surface)', 
              fontSize: '0.875rem', 
              width: '45px', 
              textAlign: 'right',
              outline: 'none',
              padding: 0
            }}
          />
          <span className="technical-label" style={{ color: 'var(--on-surface)', fontSize: '0.875rem' }}>{unit}</span>
        </div>
      </div>
      <input 
        type="range" 
        min={min} 
        max={max} 
        value={value} 
        onChange={(e) => onChange(Number(e.target.value))}
        style={{
          width: '100%',
          appearance: 'none',
          background: 'transparent',
          cursor: 'pointer',
          height: '48px',
          margin: '-12px 0'
        }}
      />
      <style>{`
        input[type=number]::-webkit-inner-spin-button, 
        input[type=number]::-webkit-outer-spin-button { 
          -webkit-appearance: none; 
          margin: 0; 
        }
        input[type=range]::-webkit-slider-runnable-track {
          width: 100%;
          height: 4px;
          background: var(--surface-container-highest);
          border: none;
          border-radius: 2px;
        }
        input[type=range]::-webkit-slider-thumb {
          appearance: none;
          border: none;
          height: 24px;
          width: 20px;
          border-radius: 4px;
          background: ${trackColor};
          margin-top: -10px;
        }
        input[type=range]:focus {
          outline: none;
        }
      `}</style>
    </div>
  );
}

export default App;
