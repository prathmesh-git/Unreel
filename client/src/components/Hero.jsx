import { Link2, Upload, Film, ArrowRight, AlertCircle, FileText } from 'lucide-react';

const PLATFORM_ICONS = {
  youtube: (
    <svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor">
      <path d="M23.5 6.19a3.02 3.02 0 0 0-2.12-2.14C19.54 3.5 12 3.5 12 3.5s-7.54 0-9.38.55A3.02 3.02 0 0 0 .5 6.19C0 8.04 0 12 0 12s0 3.96.5 5.81a3.02 3.02 0 0 0 2.12 2.14C4.46 20.5 12 20.5 12 20.5s7.54 0 9.38-.55a3.02 3.02 0 0 0 2.12-2.14C24 15.96 24 12 24 12s0-3.96-.5-5.81zM9.75 15.52V8.48L15.84 12l-6.09 3.52z" />
    </svg>
  ),
  instagram: (
    <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="2" y="2" width="20" height="20" rx="5" ry="5"/>
      <circle cx="12" cy="12" r="4"/>
      <circle cx="17.5" cy="6.5" r="0.5" fill="currentColor" stroke="none"/>
    </svg>
  ),
  tiktok: (
    <svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor">
      <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-2.88 2.5 2.89 2.89 0 0 1-2.89-2.89 2.89 2.89 0 0 1 2.89-2.89c.28 0 .54.04.79.1V9.01a6.3 6.3 0 0 0-.79-.05 6.34 6.34 0 0 0-6.34 6.34 6.34 6.34 0 0 0 6.34 6.34 6.34 6.34 0 0 0 6.33-6.34V8.69a8.15 8.15 0 0 0 4.77 1.52V6.77a4.85 4.85 0 0 1-1-.08z"/>
    </svg>
  ),
  twitter: (
    <svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
    </svg>
  ),
};

export default function Hero({
  activeTab, setActiveTab, url, setUrl,
  selectedFile, setSelectedFile,
  transcript, setTranscript,
  status, error, canUpload, currentStep, loadingSteps,
  onAnalyzeUrl, onAnalyzeUpload, onAnalyzeText, onReset, onSwitchToUpload,
}) {
  function handleDragOver(e) { e.preventDefault(); e.currentTarget.classList.add('drag-over'); }
  function handleDragLeave(e) { e.currentTarget.classList.remove('drag-over'); }
  function handleDrop(e) {
    e.preventDefault(); e.currentTarget.classList.remove('drag-over');
    const file = e.dataTransfer.files[0];
    if (file && (file.type.startsWith('video/') || file.type.startsWith('audio/'))) setSelectedFile(file);
  }

  return (
    <section className="hero" aria-labelledby="hero-title">
      <div className="hero-badge">
        <span className="pulse-dot" aria-hidden="true" />
        AI-Powered Fact Checking
      </div>

      <h1 id="hero-title" className="hero-title">
        Reveal the Truth<br />
        <span className="gradient-text">Behind Every Reel</span>
      </h1>

      <p className="hero-subtitle">
        Paste a URL, upload a video, or add a transcript.<br />
        Our AI analyzes claims, checks facts, and detects bias — in seconds.
      </p>

      {/* Analyze Card */}
      <div className="analyze-card">
        {status === 'idle' && (
          <>
            <div className="tabs" role="tablist">
              <button
                className={`tab ${activeTab === 'url' ? 'active' : ''}`}
                role="tab" aria-selected={activeTab === 'url'}
                onClick={() => { setActiveTab('url'); onReset(); }}
              >
                <Link2 className="icon-sm" /> Paste URL
              </button>
              <button
                className={`tab ${activeTab === 'upload' ? 'active' : ''}`}
                role="tab" aria-selected={activeTab === 'upload'}
                onClick={() => { setActiveTab('upload'); onReset(); }}
              >
                <Upload className="icon-sm" /> Upload Video
              </button>
              <button
                className={`tab ${activeTab === 'text' ? 'active' : ''}`}
                role="tab" aria-selected={activeTab === 'text'}
                onClick={() => { setActiveTab('text'); onReset(); }}
              >
                <FileText className="icon-sm" /> Paste Transcript
              </button>
            </div>

            {activeTab === 'url' && (
              <form onSubmit={onAnalyzeUrl}>
                <div className="input-group">
                  <div className="input-wrapper">
                    <span className="input-icon"><Link2 className="icon-sm" /></span>
                    <input
                      type="url" className="url-input" value={url}
                      onChange={e => setUrl(e.target.value)}
                      placeholder="https://www.instagram.com/reel/..."
                      aria-label="Video URL" required
                    />
                  </div>
                  <button type="submit" className="analyze-btn">
                    <span className="btn-content">Analyze URL <ArrowRight className="icon-sm" /></span>
                  </button>
                </div>
                <p className="input-hint">YouTube Shorts · Instagram Reels · TikTok · Twitter/X</p>
              </form>
            )}

            {activeTab === 'upload' && (
              <form onSubmit={onAnalyzeUpload}>
                <div
                  className="upload-area"
                  onClick={() => document.getElementById('file-input').click()}
                  onDragOver={handleDragOver} onDragLeave={handleDragLeave} onDrop={handleDrop}
                  role="button" tabIndex={0} aria-label="Upload video"
                >
                  <div className="upload-area-icon"><Film className="icon-2xl" /></div>
                  <p className="upload-text">Click to upload or drag & drop</p>
                  <p className="upload-hint">MP4, MOV, AVI · Max 100MB</p>
                  {selectedFile && <p className="upload-selected">{selectedFile.name}</p>}
                </div>
                <input id="file-input" type="file" accept="video/*,audio/*" style={{ display: 'none' }}
                  onChange={e => setSelectedFile(e.target.files[0])} />
                <button type="submit" className="analyze-btn full-width" disabled={!selectedFile}>
                  <span className="btn-content">Analyze Video <ArrowRight className="icon-sm" /></span>
                </button>
              </form>
            )}

            {activeTab === 'text' && (
              <form onSubmit={onAnalyzeText}>
                <div className="input-group vertical">
                  <textarea
                    className="transcript-input"
                    value={transcript}
                    onChange={e => setTranscript(e.target.value)}
                    placeholder="Paste the video transcript or any text you want fact-checked…"
                    aria-label="Transcript text"
                    rows={6}
                    required
                  />
                  <button type="submit" className="analyze-btn full-width" disabled={transcript.trim().length < 20}>
                    <span className="btn-content">Analyze Text <ArrowRight className="icon-sm" /></span>
                  </button>
                </div>
                <p className="input-hint">Paste a video transcript, article snippet, or any content to fact-check.</p>
              </form>
            )}


          </>
        )}

        {status === 'loading' && (
          <div className="loading-state">
            <div className="loading-animation" aria-hidden="true">
              <div className="loading-ring" />
              <div className="loading-ring delay-1" />
              <div className="loading-ring delay-2" />
            </div>
            <p className="loading-title">Analyzing your video...</p>
            <div className="loading-steps">
              {loadingSteps.map((s, i) => (
                <div key={s.id} className={`step ${i === currentStep ? 'active' : i < currentStep ? 'done' : ''}`}>
                  <span className="step-dot" aria-hidden="true" />
                  <span>{s.label}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {status === 'error' && (
          <div className="error-state" role="alert">
            <div className="error-icon"><AlertCircle className="icon-xl" /></div>
            <p className="error-message">{error}</p>
            {canUpload && (
              <button className="upload-fallback-btn" onClick={onSwitchToUpload}>
                <Upload className="icon-sm" /> Upload the video file instead
              </button>
            )}
            <button className="retry-btn" onClick={onReset}>Try Again</button>
          </div>
        )}
      </div>

      {/* Platform badges */}
      {status === 'idle' && (
        <div className="platform-badges" aria-label="Supported platforms">
          <span className="platform-badge yt">{PLATFORM_ICONS.youtube} YouTube</span>
          <span className="platform-badge ig">{PLATFORM_ICONS.instagram} Instagram</span>
          <span className="platform-badge tt">{PLATFORM_ICONS.tiktok} TikTok</span>
          <span className="platform-badge tw">{PLATFORM_ICONS.twitter} Twitter/X</span>
        </div>
      )}
    </section>
  );
}
