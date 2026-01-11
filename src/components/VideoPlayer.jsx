import React, {
  useEffect,
  useRef,
  useState,
  useCallback,
  useMemo,
} from "react";
import { createPortal } from 'react-dom';
import PropTypes from 'prop-types';
import api from "../utils/api";
import { useAuth } from "../hooks/useAuth";

// Resolution map used to match quality labels to level heights
const RES_MAP = {
  "144": { w: 256, h: 144 },
  "240": { w: 426, h: 240 },
  "360": { w: 640, h: 360 },
  "480": { w: 854, h: 480 },
  "720": { w: 1280, h: 720 },
  "1080": { w: 1920, h: 1080 },
  "1440": { w: 2560, h: 1440 },
  "2160": { w: 3840, h: 2160 },
};

function VideoPlayer({ video = null }) {
  const DEBUG_LONGPRESS = false;
  const dlog = (...args) => {
    try { if (DEBUG_LONGPRESS) console.debug('[VP.longpress]', ...args); } catch (e) {}
  };
  // Global player debug flag (set via Vite env `VITE_VIDEO_PLAYER_DEBUG=1`)
  const PLAYER_DEBUG = (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_VIDEO_PLAYER_DEBUG === '1') || false;
  const pdebug = (...args) => { try { if (PLAYER_DEBUG) console.debug('[VP]', ...args); } catch (e) {} };
  
  // long-press/jitter tuning
  const CONTROLS_REVEAL_SUPPRESS_MS = 1000;
  const JITTER_WINDOW_MS = 500;
  const JITTER_COUNT_THRESHOLD = 4;
  const pointerDownTimesRef = useRef([]);
  const lastJitterAtRef = useRef(0);
  const videoRef = useRef(null);
  const containerRef = useRef(null);
  const centerPlayRef = useRef(null);
  const fsButtonRef = useRef(null);
  const progressRef = useRef(null);
  const qualityRef = useRef(null);
  const speedRef = useRef(null);
  const settingsRef = useRef(null);
  const settingsMenuRef = useRef(null);
  const hlsRef = useRef(null);
  const rafPendingRef = useRef(false);
  const saveLastRef = useRef(0);

  const [isPlaying, setIsPlaying] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [showRemaining, setShowRemaining] = useState(false);
  const [bufferedPercent, setBufferedPercent] = useState(0);
  const pointerLongSuppressClickRef = useRef(false);
  const ignoreToggleRef = useRef(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showErrorOverlay, setShowErrorOverlay] = useState(false);
  const errorTimerRef = useRef(null);
  const errorSetDelayRef = useRef(null);
  const hlsErrorAttemptsRef = useRef(0); // تتبع عدد محاولات الخطأ (max 2)
  const qualityChangeAttemptsRef = useRef(0); // تتبع محاولات تغيير الجودة (max 2)
  const feedbackTimersRef = useRef(new Set());
  const spaceLongPressTimerRef = useRef(null);
  const pointerLongPressTimerRef = useRef(null);
  const [qualityMenuOpen, setQualityMenuOpen] = useState(false);
  const [speedMenuOpen, setSpeedMenuOpen] = useState(false);
  const [settingsMenuOpen, setSettingsMenuOpen] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [fullscreenBottomInset, setFullscreenBottomInset] = useState(0);
  const fullscreenTransitionRef = useRef(false);
  const prevHlsLevelRef = useRef(null);
  const hlsFreezeTimeoutRef = useRef(null);
  const [currentQuality, setCurrentQuality] = useState(null);
  const manualQualityRef = useRef(null);
  const [shouldInit, setShouldInit] = useState(true);

  const [volume, setVolume] = useState(() => {
    try {
      const saved = localStorage.getItem("video-volume");
      return saved ? Math.min(1, Math.max(0, parseFloat(saved))) : 0.7;
    } catch (e) {
      return 0.7;
    }
  });

  const _initialVolumeRef = useRef(true);
  const prevPlaybackRateRef = useRef(null);
  const longHoldCountRef = useRef(0);
  const spaceLongActiveRef = useRef(false);
  const pointerLongActiveRef = useRef(false);

  const [playbackRate, setPlaybackRate] = useState(() => {
    try {
      const saved = localStorage.getItem("video-rate");
      return saved ? Math.min(3, Math.max(0.25, parseFloat(saved))) : 1.0;
    } catch (e) {
      return 1.0;
    }
  });
  
  const [isLongPressActive, setIsLongPressActive] = useState(false);
  const [isPendingLongPress, setIsPendingLongPress] = useState(false);
  const controlsRevealedAtRef = useRef(0);
  const showControlsRef = useRef(showControls);

  useEffect(() => { showControlsRef.current = showControls; }, [showControls]);

  const [actionFeedback, setActionFeedback] = useState({
    visible: false,
    icon: null,
    text: "",
  });

  const [seekFeedback, setSeekFeedback] = useState({
    visible: false,
    type: "",
    time: "",
  });

  const [rateFeedback, setRateFeedback] = useState({ visible: false, rate: 1 });
  const [volumeFeedback, setVolumeFeedback] = useState({ visible: false, volume: 0 });
  const [showVolumeSlider, setShowVolumeSlider] = useState(false);
  const [hoverProgress, setHoverProgress] = useState(false);
  const [hoverTime, setHoverTime] = useState(null);
  const [hoverPosPct, setHoverPosPct] = useState(0);

  const formatTime = useCallback((seconds) => {
    if (seconds == null || isNaN(seconds)) return "0:00";
    const sec = Math.floor(seconds);
    const hrs = Math.floor(sec / 3600);
    const mins = Math.floor((sec % 3600) / 60);
    const secs = sec % 60;
    if (hrs > 0) {
      return `${hrs}:${mins < 10 ? "0" : ""}${mins}:${secs < 10 ? "0" : ""}${secs}`;
    }
    return `${mins}:${secs < 10 ? "0" : ""}${secs}`;
  }, []);

  const handleProgressMouseMove = useCallback((e) => {
    try {
      if (rafPendingRef.current) return;
      rafPendingRef.current = true;
      requestAnimationFrame(() => {
        try {
          if (!progressRef.current || !duration || !e || e.clientX === undefined) return;
          const rect = progressRef.current.getBoundingClientRect();
          const clientX = e.clientX;
          // حساب الموقع حسب الاتجاه (RTL/LTR)
          const isRtl = getComputedStyle(progressRef.current).direction === "rtl";
          const x = isRtl ? rect.right - clientX : clientX - rect.left;
          if (x < 0 || x > rect.width) return;
          const pct = Math.max(0, Math.min(1, rect.width > 0 ? x / rect.width : 0));
          const seconds = Math.round(pct * duration);
          setHoverPosPct(pct * 100);
          setHoverTime(formatTime(seconds));
        } catch (err) {
          console.error('handleProgressMouseMove error:', err);
        } finally {
          rafPendingRef.current = false;
        }
      });
    } catch (err) {
      console.error('handleProgressMouseMove outer error:', err);
      rafPendingRef.current = false;
    }
  }, [duration, formatTime]);

  const hideControlsTimeoutRef = useRef(null);
  const prevVolumeRef = useRef(volume);
  const progressDragRef = useRef(false);
  const progressDragStartXRef = useRef(0);
  const progressDragStartTimeRef = useRef(0);
  const lastRenderedTimeRef = useRef(0);
  const savedPosRef = useRef(null);
  const wasPlayingRef = useRef(false);
  const qualityOpenRef = useRef(false);
  const speedOpenRef = useRef(false);
  const settingsOpenRef = useRef(false);
  const ignoreDocClickRef = useRef(false);
  const [settingsMenuPos, setSettingsMenuPos] = useState(null);

  const { user, isLoggedIn } = useAuth();

  const isTouchDevice = useCallback(() => {
    return ('ontouchstart' in window) || 
           (navigator.maxTouchPoints > 0) ||
           (navigator.msMaxTouchPoints > 0);
  }, []);
  
  const isTouchInput = useRef(isTouchDevice());
  const pointerTypeRef = useRef(null);
  
  const [interactionState, setInteractionState] = useState({
    controlsVisible: true,
    lastInteractionTime: Date.now(),
    isTouchInteraction: false,
    isMouseInteraction: false,
    pendingTap: false
  });
  
  const [longPressState, setLongPressState] = useState({
    active: false,
    position: null,
    type: null
  });
  
  const MOBILE_HIDE_TIMEOUT = 3000;
  const DESKTOP_HIDE_TIMEOUT = 2000;
  const MOBILE_TAP_TIMEOUT = 300;
  const LONG_PRESS_THRESHOLD = 500;
  
  // RES_MAP moved to module scope to avoid recreating the map on each render
  /* RES_MAP is defined at module scope */

  const scheduleHideControls = useCallback((delay) => {
    if (hideControlsTimeoutRef.current) {
      clearTimeout(hideControlsTimeoutRef.current);
    }
    
    if (longPressState.active || spaceLongActiveRef.current) return;
    if (qualityOpenRef.current || speedOpenRef.current || settingsOpenRef.current) return;
    
    const hideDelay = delay || (isTouchInput.current ? MOBILE_HIDE_TIMEOUT : DESKTOP_HIDE_TIMEOUT);
    
    hideControlsTimeoutRef.current = setTimeout(() => {
      if (!qualityOpenRef.current && !speedOpenRef.current && !settingsOpenRef.current) {
        setShowControls(false);
      }
    }, hideDelay);
  }, [longPressState.active]);

  const clearHideControls = useCallback(() => {
    if (hideControlsTimeoutRef.current) {
      clearTimeout(hideControlsTimeoutRef.current);
      hideControlsTimeoutRef.current = null;
    }
  }, []);

  const showControlsWithOptions = useCallback((options = {}) => {
    const { immediate = true, extendTimeout = true } = options;
    
    setInteractionState(prev => ({
      ...prev,
      controlsVisible: true,
      lastInteractionTime: Date.now()
    }));
    
    if (immediate) {
      setShowControls(true);
    }
    
    if (extendTimeout) {
      clearHideControls();
      scheduleHideControls();
    }
  }, [clearHideControls, scheduleHideControls]);

  const hideControlsSafe = useCallback(() => {
    if (qualityMenuOpen || speedMenuOpen || settingsMenuOpen) return;
    if (longPressState.active || spaceLongActiveRef.current) return;
    
    setShowControls(false);
    setInteractionState(prev => ({
      ...prev,
      controlsVisible: false
    }));
  }, [qualityMenuOpen, speedMenuOpen, settingsMenuOpen, longPressState.active]);

  const showActionFeedback = useCallback((icon, text, timeout = 800) => {
    setActionFeedback({ visible: true, icon, text, position: 'center' });
    const t = setTimeout(() => {
      setActionFeedback({ visible: false, icon: null, text: "", position: 'center' });
      try { feedbackTimersRef.current.delete(t); } catch (e) {}
    }, timeout);
    try { feedbackTimersRef.current.add(t); } catch (e) {}
  }, []);

  const showSeekFeedback = useCallback((type) => {
    const time = type === "forward" ? "+5s" : "-5s";
    setSeekFeedback({ visible: true, type, time });
    const t = setTimeout(() => {
      setSeekFeedback({ visible: false, type: "", time: "" });
      try { feedbackTimersRef.current.delete(t); } catch (e) {}
    }, 800);
    try { feedbackTimersRef.current.add(t); } catch (e) {}
  }, []);

  const showActionFeedbackPos = useCallback((icon, text, timeout = 800, position = 'center') => {
    setActionFeedback({ visible: true, icon, text, position });
    setTimeout(
      () => setActionFeedback({ visible: false, icon: null, text: "", position: 'center' }),
      timeout,
    );
  }, []);

  const startDoubleSpeed = useCallback(() => {
    try {
      longHoldCountRef.current = (longHoldCountRef.current || 0) + 1;
      if (longHoldCountRef.current === 1) {
        prevPlaybackRateRef.current = playbackRate;
        const next = 2.0;
        try { dlog('startDoubleSpeed', { from: playbackRate, to: next }); } catch (e) {}
        setPlaybackRate(next);
        setActionFeedback({ visible: true, icon: Icons.Speed, text: `${next.toFixed(2)}x`, position: 'top' });
        try { ignoreToggleRef.current = true; } catch (e) {}
        try { setIsLongPressActive(true); } catch (e) {}
      }
    } catch (e) {}
  }, [playbackRate]);

  const stopDoubleSpeed = useCallback(() => {
    try {
      longHoldCountRef.current = Math.max(0, (longHoldCountRef.current || 0) - 1);
      if (longHoldCountRef.current === 0) {
        const prev = prevPlaybackRateRef.current;
        if (typeof prev === 'number') {
          try { dlog('stopDoubleSpeed', { restoreTo: prev }); } catch (e) {}
          setPlaybackRate(prev);
        }
        prevPlaybackRateRef.current = null;
        setActionFeedback({ visible: false, icon: null, text: '', position: 'center' });
        try { scheduleHideControls(1000); } catch (e) {}
        try { setIsLongPressActive(false); } catch (e) {}
      }
    } catch (e) {}
  }, []);

  const showRateFeedback = useCallback((rate) => {
    setRateFeedback({ visible: true, rate });
    const t = setTimeout(() => {
      setRateFeedback({ visible: false, rate: 1 });
      try { feedbackTimersRef.current.delete(t); } catch (e) {}
    }, 1000);
    try { feedbackTimersRef.current.add(t); } catch (e) {}
  }, []);

  const showVolumeFeedback = useCallback((vol, timeout = 800) => {
    try {
      const pct = Math.round((vol || 0) * 100);
      setVolumeFeedback({ visible: true, volume: pct });
      const t = setTimeout(() => setVolumeFeedback({ visible: false, volume: 0 }), timeout);
      try { feedbackTimersRef.current.add(t); } catch (e) {}
    } catch (e) {}
  }, []);

  const handleVolumeWheel = useCallback((e) => {
    try {
      e.preventDefault();
      const delta = e.deltaY || 0;
      const step = 0.02;
      const next = Math.round(Math.min(1, Math.max(0, volume + (delta < 0 ? step : -step))) * 100) / 100;
      if (next > 0) prevVolumeRef.current = next;
      setVolume(next);
      showVolumeFeedback(next);
      showControlsWithOptions();
    } catch (err) {}
  }, [volume, showVolumeFeedback, showControlsWithOptions]);

  const preventScrollHandler = useCallback((ev) => {
    try { ev.preventDefault(); } catch (e) {}
  }, []);

  const disablePageScrollWhileInteracting = useCallback(() => {
    try {
      if (isTouchInput.current) return;
      document.addEventListener('wheel', preventScrollHandler, { passive: false });
      document.addEventListener('touchmove', preventScrollHandler, { passive: false });
    } catch (e) {}
  }, [preventScrollHandler]);

  const enablePageScrollAfterInteracting = useCallback(() => {
    try {
      document.removeEventListener('wheel', preventScrollHandler, { passive: false });
      document.removeEventListener('touchmove', preventScrollHandler, { passive: false });
    } catch (e) {}
  }, [preventScrollHandler]);

  useEffect(() => {
    if (_initialVolumeRef.current) {
      _initialVolumeRef.current = false;
      return;
    }
    showVolumeFeedback(volume);
  }, [volume, showVolumeFeedback]);

  useEffect(() => { qualityOpenRef.current = qualityMenuOpen; }, [qualityMenuOpen]);
  useEffect(() => { speedOpenRef.current = speedMenuOpen; }, [speedMenuOpen]);
  useEffect(() => { settingsOpenRef.current = settingsMenuOpen; }, [settingsMenuOpen]);

  const safePlay = useCallback(() => {
    try {
      const v = videoRef.current;
      if (!v) return;
      setIsPlaying(true);
      const playPromise = v.play();
      if (playPromise && typeof playPromise.then === "function") {
        playPromise.then(() => {
          setIsPlaying(true);
          try { setError(null); } catch (e) {}
          try { setShowErrorOverlay(false); } catch (e) {}
          if (errorTimerRef.current) {
            try { clearTimeout(errorTimerRef.current); } catch (e) {}
            errorTimerRef.current = null;
          }
          if (errorSetDelayRef.current) {
            try { clearTimeout(errorSetDelayRef.current); } catch (e) {}
            errorSetDelayRef.current = null;
          }
        }).catch((err) => {
          if (err && err.name === "AbortError") return;
          console.warn("Playback error:", err);
          try { setIsPlaying(false); } catch (e) {}
        });
      }
    } catch (e) {
      console.warn("Safe play error:", e);
    }
  }, []);

  const togglePlayPause = useCallback(() => {
    try {
      try {
        dlog('togglePlayPause called, ignoreToggle=', ignoreToggleRef.current);
        const now = Date.now();
        if (controlsRevealedAtRef.current && (now - controlsRevealedAtRef.current) < CONTROLS_REVEAL_SUPPRESS_MS) {
          dlog('togglePlayPause suppressed: controls were just revealed', { age: now - controlsRevealedAtRef.current });
          controlsRevealedAtRef.current = 0;
          return;
        }
        if (ignoreToggleRef.current) {
          ignoreToggleRef.current = false;
          dlog('togglePlayPause suppressed by ignoreToggle');
          return;
        }
      } catch (e) {}
      const v = videoRef.current;
      if (!v) return;
      if (v.paused) {
        safePlay();
      } else {
        v.pause();
        setIsPlaying(false);
      }
      setShowControls(true);
      scheduleHideControls(3000);
    } catch (e) {
      console.warn("Toggle play/pause error:", e);
    }
  }, [safePlay, scheduleHideControls]);

  const togglePlayPauseImmediate = useCallback(() => {
    try {
      const v = videoRef.current;
      if (!v) return;
      if (v.paused) {
        safePlay();
      } else {
        v.pause();
        setIsPlaying(false);
      }
      setShowControls(true);
      scheduleHideControls(3000);
    } catch (e) {
      console.warn('Immediate toggle error:', e);
    }
  }, [safePlay, scheduleHideControls]);

  const retryPlayback = useCallback(() => {
    try {
      setError(null);
      setLoading(true);
      if (hlsRef.current) {
        try {
          hlsRef.current.destroy();
        } catch (e) {}
        hlsRef.current = null;
      }
      if (videoRef.current) {
        videoRef.current.pause();
        videoRef.current.removeAttribute("src");
        try {
          videoRef.current.load();
        } catch (e) {}
      }
      setShouldInit(false);
      setTimeout(() => {
        setShouldInit(true);
      }, 80);
    } catch (e) {
      console.warn("Retry playback error:", e);
    }
  }, []);

  const toggleFullscreen = useCallback(() => {
    try {
      if (!videoRef.current) return;
      const container = containerRef.current || videoRef.current.parentElement;
      if (!container) return;
      if (!document.fullscreenElement) {
        if (container.requestFullscreen) container.requestFullscreen();
        else if (container.webkitRequestFullscreen) container.webkitRequestFullscreen();
        else if (container.msRequestFullscreen) container.msRequestFullscreen();
        else {
          const v = videoRef.current;
          if (v && v.requestFullscreen) v.requestFullscreen();
          else if (v && v.webkitRequestFullscreen) v.webkitRequestFullscreen();
          else if (v && v.msRequestFullscreen) v.msRequestFullscreen();
        }
      } else {
        if (document.exitFullscreen) document.exitFullscreen();
        else if (document.webkitExitFullscreen) document.webkitExitFullscreen();
        else if (document.msExitFullscreen) document.msExitFullscreen();
      }
    } catch (e) {
      console.warn("Fullscreen toggle error:", e);
    }
  }, []);

  const updateVideoSizing = useCallback(() => {
    try {
      const v = videoRef.current;
      if (!v) return;
      if (isFullscreen) {
        v.style.width = "auto";
        v.style.height = "100%";
        v.style.objectFit = "contain";
        v.style.maxWidth = "100%";
        v.style.maxHeight = "100%";
        v.style.display = "block";
        v.style.margin = "0 auto";
      } else {
        v.style.width = "100%";
        v.style.height = "100%";
        v.style.objectFit = "contain";
        v.style.maxWidth = "100%";
        v.style.maxHeight = "100%";
        v.style.display = "block";
        v.style.margin = "0";
      }
    } catch (e) {
      console.warn("Update video sizing error:", e);
    }
  }, [isFullscreen]);

  const isProgressRtl = useCallback(() => {
    try {
      const el = progressRef.current;
      if (!el) return document && document.dir === "rtl";
      return getComputedStyle(el).direction === "rtl";
    } catch (e) {
      return document && document.dir === "rtl";
    }
  }, []);

  const handleSeek = useCallback((e) => {
    if (!videoRef.current || !duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const rtl = isProgressRtl();
    const x = e.clientX - rect.left;
    let percentage = x / rect.width;
    if (rtl) percentage = 1 - percentage;
    const newTime = Math.max(0, Math.min(1, percentage)) * duration;
    videoRef.current.currentTime = newTime;
    setCurrentTime(newTime);
  }, [duration, isProgressRtl]);

  const handlePointerSeekStart = useCallback((e) => {
    if (!videoRef.current || !duration) return;
    e.preventDefault();
    e.stopPropagation();
    progressDragRef.current = true;
    progressDragStartXRef.current = e.clientX || 0;
    progressDragStartTimeRef.current = videoRef.current.currentTime || 0;
    window.addEventListener("pointermove", handlePointerSeekMove);
    window.addEventListener("pointerup", handlePointerSeekEnd);
    showControlsWithOptions();
  }, [duration, showControlsWithOptions]);

  const handlePointerSeekMove = useCallback((e) => {
    if (!progressDragRef.current || !videoRef.current || !duration || !progressRef.current) return;
    e.preventDefault();
    const rect = progressRef.current.getBoundingClientRect();
    const rtl = isProgressRtl();
    let x = e.clientX - rect.left;
    x = Math.max(0, Math.min(rect.width, x));
    let percentage = x / rect.width;
    if (rtl) percentage = 1 - percentage;
    const newTime = Math.max(0, Math.min(1, percentage)) * duration;
    videoRef.current.currentTime = newTime;
    setCurrentTime(newTime);
  }, [duration, isProgressRtl]);

  const handlePointerSeekEnd = useCallback(() => {
    progressDragRef.current = false;
    progressDragStartXRef.current = 0;
    progressDragStartTimeRef.current = 0;
    window.removeEventListener("pointermove", handlePointerSeekMove);
    window.removeEventListener("pointerup", handlePointerSeekEnd);
    scheduleHideControls(1000);
  }, [scheduleHideControls]);

  const applyQualityToHls = useCallback((hls, quality) => {
    if (!hls || !hls.levels || !quality) return;
    const target = RES_MAP[String(quality)];
    let bestIdx = -1;
    if (target) {
      for (let i = 0; i < hls.levels.length; i++) {
        const lvl = hls.levels[i];
        const h = lvl?.height || 0;
        if (String(h) === String(target.h)) {
          bestIdx = i;
          break;
        }
      }
    }

    if (bestIdx < 0) {
      let bestDiff = Infinity;
      for (let i = 0; i < hls.levels.length; i++) {
        const lvl = hls.levels[i];
        const h = lvl?.height || 0;
        const diff = Math.abs((target ? target.h : Number(quality)) - h);
        if (diff < bestDiff) {
          bestDiff = diff;
          bestIdx = i;
        }
      }
    }

    if (bestIdx >= 0) {
      try {
        // إعادة تعيين محاولات تغيير الجودة عند محاولة جديدة
        qualityChangeAttemptsRef.current = 0;
        try { hls.autoLevelEnabled = false; } catch (e) {}
        try { hls.nextLevel = bestIdx; } catch (e) {}
        try { hls.currentLevel = bestIdx; } catch (e) {}
        setTimeout(() => {
          try { hls.currentLevel = bestIdx; } catch (e) {}
        }, 250);
      } catch (e) {
        console.warn('applyQualityToHls error:', e);
      }
    }
    return bestIdx;
  }, []);

  const handleQualityChangePersist = useCallback((q) => {
    try {
      localStorage.setItem(`video-default-quality-${video._id}`, String(q));
    } catch (e) {}
    // remember that the user explicitly chose this quality
    try { manualQualityRef.current = q; } catch (e) {}
    setCurrentQuality(q);
    
    // Show feedback to user
    try { showActionFeedbackPos(Icons.Quality, `جودة ${q}p`, 800, 'top'); } catch (e) {}
    
    // Delay menu close to ensure state updates first (100ms for mobile reliability)
    setTimeout(() => {
      setQualityMenuOpen(false);
      setSettingsMenuOpen(false);
    }, 100);

    // Reinitialize the player to force HLS to load the chosen quality as the starting
    // manifest/level. This avoids ABR immediately switching back to a previously
    // observed level. Use a short toggle to re-run the initPlayer effect.
    try {
      setShouldInit(false);
      setTimeout(() => {
        try { setShouldInit(true); } catch (e) {}
      }, 80);
    } catch (e) {}

    try {
      const uc = localStorage.getItem("userCode");
      const did = localStorage.getItem("deviceId");
      const st = localStorage.getItem("sessionToken");
      const qsParts = [];
      if (uc) qsParts.push(`userCode=${encodeURIComponent(uc)}`);
      if (did) qsParts.push(`deviceId=${encodeURIComponent(did)}`);
      if (st) qsParts.push(`sessionToken=${encodeURIComponent(st)}`);
      const relativePath = `/api/videos/${video._id}/playlist/${encodeURIComponent(q)}.m3u8${qsParts.length ? `?${qsParts.join('&')}` : ''}`;
      const API_BASE = import.meta.env.VITE_API_BASE || '';
      const base = API_BASE ? API_BASE.replace(/\/$/, '') : '';
      const playlistUrl = base ? `${base}${relativePath}` : relativePath;

      try {
        const v = videoRef.current;
        savedPosRef.current = v ? (v.currentTime || 0) : 0;
        wasPlayingRef.current = v ? (!v.paused && !v.ended) : false;
      } catch (e) {
        savedPosRef.current = null;
        wasPlayingRef.current = false;
      }

      const onLoadedMeta = () => {
        try {
          const v = videoRef.current;
          if (v && savedPosRef.current != null && !isNaN(savedPosRef.current)) {
            try { v.currentTime = savedPosRef.current; } catch (e) {}
          }
          if (wasPlayingRef.current) {
            try { safePlay(); } catch (e) {}
          }
        } catch (e) {}
        try { videoRef.current && videoRef.current.removeEventListener('loadedmetadata', onLoadedMeta); } catch (e) {}
        savedPosRef.current = null;
        wasPlayingRef.current = false;
      };
      try { videoRef.current && videoRef.current.addEventListener('loadedmetadata', onLoadedMeta); } catch (e) {}

      if (hlsRef.current) {
        try {
          pdebug('HLS: loading playlist for quality', q, playlistUrl);
          try { hlsRef.current.autoLevelEnabled = false; } catch (e) {}
          try { hlsRef.current.loadSource(playlistUrl); } catch (e) {}
          try { hlsRef.current.attachMedia(videoRef.current); } catch (e) {}
              setTimeout(() => {
                try { safePlay(); } catch (e) {}
              }, 250);
          try {
            const appliedIdx = applyQualityToHls(hlsRef.current, q);
            // Force re-apply for a short window until hls honors the manual level.
            let attempts = 0;
            const reapply = setInterval(() => {
              attempts += 1;
              try {
                const idx = applyQualityToHls(hlsRef.current, q);
                if (typeof idx === 'number' && idx >= 0) {
                  try { hlsRef.current.currentLevel = idx; } catch (e) {}
                  // if currentLevel matches, stop retrying
                  try {
                    if (hlsRef.current.currentLevel === idx) {
                      clearInterval(reapply);
                    }
                  } catch (e) {}
                }
              } catch (e) {}
              if (attempts > 6) clearInterval(reapply);
            }, 350);
          } catch (e) {}
        } catch (e) {}
      } else if (videoRef.current) {
        const v = videoRef.current;
        const wasPlaying = !!(v && !v.paused && !v.ended);
        try { v.pause(); } catch (e) {}
        try {
          v.removeAttribute('src');
          v.src = playlistUrl;
          v.load();
        } catch (e) {}
        if (wasPlaying) {
          setTimeout(() => {
            try { v.play(); } catch (e) {}
          }, 120);
        }
      }
    } catch (e) {
      console.warn('Apply quality error:', e);
    }
  }, [video, applyQualityToHls, safePlay, showActionFeedbackPos]);

  const adjustRate = useCallback((delta) => {
    try {
      const v = Math.round(Math.max(0.25, Math.min(3, playbackRate + delta)) * 100) / 100;
      setPlaybackRate(v);
      try { showActionFeedbackPos(Icons.Speed, `${v.toFixed(2)}x`, 800, 'top'); } catch (e) { showRateFeedback(v); }
      showControlsWithOptions();
    } catch (e) {
      console.warn("Adjust rate error:", e);
    }
  }, [playbackRate, showRateFeedback, showControlsWithOptions]);

  const startLongPress = useCallback((type, position) => {
    if (type === 'pointer' && isTouchInput.current) {
      setLongPressState({
        active: true,
        position,
        type
      });
      
      pointerLongSuppressClickRef.current = true;
      startDoubleSpeed();
      showControlsWithOptions({ immediate: true, extendTimeout: false });
      setIsLongPressActive(true);
    }
  }, [startDoubleSpeed, showControlsWithOptions]);

  const stopLongPress = useCallback(() => {
    if (longPressState.active) {
      setLongPressState({
        active: false,
        position: null,
        type: null
      });
      
      setTimeout(() => {
        pointerLongSuppressClickRef.current = false;
      }, 500);
      
      stopDoubleSpeed();
      scheduleHideControls(1000);
      setIsLongPressActive(false);
    }
  }, [longPressState.active, stopDoubleSpeed, scheduleHideControls]);

  useEffect(() => {
    if (!video || !shouldInit) return;

    let HlsModule = null;
    let hls = null;
    let saveInt = null;
    let rafId = null;
    let updateTime = null;
    let onPlaying = null;

    const initPlayer = async () => {
      try {
        try {
          const mod = await import("hls.js");
          HlsModule = mod && (mod.default || mod);
        } catch (e) {
          HlsModule = null;
          console.warn("HLS.js not available:", e);
        }

        let defaultQuality = null;
        try {
          const saved = localStorage.getItem(`video-default-quality-${video._id}`);
          if (saved && video.qualities) {
            const qList = video.qualities.map(q => String(q.quality));
            if (qList.includes(saved)) defaultQuality = saved;
          }
        } catch (e) {}

        if (!defaultQuality && video.qualities && video.qualities.length > 0) {
          defaultQuality = video.qualities[video.qualities.length - 1].quality;
        }
        setCurrentQuality(defaultQuality);

        const _userCode = localStorage.getItem("userCode");
        const _deviceId = localStorage.getItem("deviceId");
        const _sessionToken = localStorage.getItem("sessionToken");
        const qsParts = [];
        if (_userCode) qsParts.push(`userCode=${encodeURIComponent(_userCode)}`);
        if (_deviceId) qsParts.push(`deviceId=${encodeURIComponent(_deviceId)}`);
        if (_sessionToken) qsParts.push(`sessionToken=${encodeURIComponent(_sessionToken)}`);
        const relativePath = `/api/videos/${video._id}/playlist/${encodeURIComponent(defaultQuality)}.m3u8${qsParts.length ? `?${qsParts.join('&')}` : ''}`;
        const API_BASE = import.meta.env.VITE_API_BASE || '';
        const base = API_BASE ? API_BASE.replace(/\/$/, '') : '';
        const playlistUrl = base ? `${base}${relativePath}` : relativePath;

        if (HlsModule && HlsModule.isSupported && videoRef.current) {
          hls = new HlsModule({
            enableWorker: true,
            lowLatencyMode: false,
            maxBufferLength: 15,
            backBufferLength: 10,
            xhrSetup: (xhr, url) => {
              try {
                xhr.withCredentials = false;
                const uc = localStorage.getItem("userCode");
                const did = localStorage.getItem("deviceId");
                const st = localStorage.getItem("sessionToken");
                if (uc) xhr.setRequestHeader('user-code', uc);
                if (did) xhr.setRequestHeader('device-id', did);
                if (st) xhr.setRequestHeader('session-token', st);
              } catch (e) {}
            },
          });


          hlsRef.current = hls;
          hlsErrorAttemptsRef.current = 0;

            hls.on(HlsModule.Events.MANIFEST_PARSED, () => {
              setError(null);
              setShowErrorOverlay(false);
              setLoading(false);
              hlsErrorAttemptsRef.current = 0; // إعادة تعيين عدد المحاولات عند نجاح التحميل
              if (errorTimerRef.current) {
                try { clearTimeout(errorTimerRef.current); } catch (e) {}
                errorTimerRef.current = null;
              }
              if (errorSetDelayRef.current) {
                try { clearTimeout(errorSetDelayRef.current); } catch (e) {}
                errorSetDelayRef.current = null;
              }
            try {
              // Use the saved/current quality (if the user changed it) instead of the
              // initially captured defaultQuality which may be stale. This prevents
              // MANIFEST_PARSED from reverting the user's chosen quality after a reload.
              try {
                const savedQ = localStorage.getItem(`video-default-quality-${video._id}`);
                const useQ = savedQ || defaultQuality;
                if (useQ) applyQualityToHls(hls, useQ);
              } catch (e) {
                if (defaultQuality) applyQualityToHls(hls, defaultQuality);
              }
            } catch (e) {}
            safePlay();
            try {
              if (videoRef.current) {
                onPlaying = () => {
                  setError(null);
                  setShowErrorOverlay(false);
                  if (errorTimerRef.current) {
                    try { clearTimeout(errorTimerRef.current); } catch (e) {}
                    errorTimerRef.current = null;
                  }
                  if (errorSetDelayRef.current) {
                    try { clearTimeout(errorSetDelayRef.current); } catch (e) {}
                    errorSetDelayRef.current = null;
                  }
                  setLoading(false);
                  setIsPlaying(true);
                };
                videoRef.current.addEventListener('playing', onPlaying);
              }
            } catch (e) {}
          });

          hls.on(HlsModule.Events.ERROR, (event, data) => {
            console.warn("HLS error:", data);
            try {
              const details = data && (data.details || data.type || '');
              const isLevelParsing = details && String(details).toLowerCase().includes('levelparsing');
              // محاولتان فقط قبل إظهار الخطأ
              if (data && data.fatal && isLevelParsing && hlsErrorAttemptsRef.current < 2) {
                hlsErrorAttemptsRef.current += 1;
                pdebug('HLS: levelParsingError detected — retrying loadSource (attempt)', hlsErrorAttemptsRef.current);
                setTimeout(() => {
                  try {
                    hls.loadSource(playlistUrl);
                    try { hls.startLoad(); } catch (e) {}
                  } catch (e) {
                    console.warn('HLS retry failed:', e);
                  }
                }, 600);
                return;
              }
            } catch (e) {}

            if (data.fatal) {
              let msg = "خطأ غير معروف";
              switch (data.type) {
                case HlsModule.ErrorTypes.NETWORK_ERROR:
                  msg = "خطأ في الشبكة - تحقق من اتصالك بالإنترنت وحاول مرة أخرى";
                  break;
                case HlsModule.ErrorTypes.MEDIA_ERROR:
                  // إذا كان الخطأ بسبب تغيير الجودة ولم نتجاوز محاولتين، حاول مرة أخرى
                  if (qualityChangeAttemptsRef.current < 2) {
                    qualityChangeAttemptsRef.current += 1;
                    pdebug('Quality change retry (attempt)', qualityChangeAttemptsRef.current);
                    setTimeout(() => {
                      if (hlsRef.current) {
                        try {
                          applyQualityToHls(hlsRef.current, currentQuality);
                        } catch (e) {
                          console.warn('Quality retry failed:', e);
                        }
                      }
                    }, 800);
                    return;
                  }
                  msg = "خطأ في الوسائط - قد يكون هناك مشكلة في الفيديو نفسه";
                  break;
                default:
                  msg = "خطأ في تشغيل البث - يرجى محاولة إعادة التحميل";
                  break;
              }
              if (errorSetDelayRef.current) {
                try { clearTimeout(errorSetDelayRef.current); } catch (e) {}
                errorSetDelayRef.current = null;
              }
              errorSetDelayRef.current = setTimeout(() => {
                hlsErrorAttemptsRef.current += 1;
                setError(msg);
                setLoading(false);
                errorSetDelayRef.current = null;
              }, 700);
            }
          });

          // If HLS switches levels (e.g., due to internal adaptation), ensure the
          // user's manual choice is re-applied so we don't silently revert to a
          // higher quality. This enforces the manual selection after level switches.
          try {
            hls.on(HlsModule.Events.LEVEL_SWITCHED, () => {
              try {
                if (manualQualityRef.current) {
                  applyQualityToHls(hls, manualQualityRef.current);
                }
              } catch (e) {}
            });
          } catch (e) {}

          hls.loadSource(playlistUrl);
          hls.attachMedia(videoRef.current);
        } else if (videoRef.current) {
          const v = videoRef.current;
          const canNativeHls = typeof v.canPlayType === "function" && (v.canPlayType('application/vnd.apple.mpegurl') || v.canPlayType('application/x-mpegURL'));
          if (canNativeHls) {
            v.src = playlistUrl;
            v.addEventListener("loadedmetadata", () => {
              setError(null);
              setLoading(false);
              const serverDuration = (video && Number(video.duration)) || 0;
              if (serverDuration > 0) setDuration(serverDuration);
              else setDuration(v.duration || 0);
            });
            try {
              onPlaying = () => {
                setError(null);
                setLoading(false);
                setIsPlaying(true);
              };
              v.addEventListener('playing', onPlaying);
            } catch (e) {}
            v.addEventListener("error", () => {
              if (errorSetDelayRef.current) {
                try { clearTimeout(errorSetDelayRef.current); } catch (e) {}
                errorSetDelayRef.current = null;
              }
              errorSetDelayRef.current = setTimeout(() => {
                const mediaError = v?.error;
                let errorMsg = "حدث خطأ في تشغيل الفيديو";
                if (mediaError) {
                  switch (mediaError.code) {
                    case 1:
                      errorMsg = "تم إلغاء تحميل الفيديو";
                      break;
                    case 2:
                      errorMsg = "خطأ في الشبكة - تحقق من اتصالك بالإنترنت";
                      break;
                    case 3:
                      errorMsg = "تم قطع تحميل الفيديو";
                      break;
                    case 4:
                      errorMsg = "صيغة الفيديو غير مدعومة";
                      break;
                    default:
                      errorMsg = "حدث خطأ في تشغيل الفيديو";
                  }
                }
                setError(errorMsg);
                setLoading(false);
                errorSetDelayRef.current = null;
              }, 700);
            });
          } else {
            setLoading(false);
            setError("متصفحك لا يدعم تشغيل هذا النوع من الفيديوهات. يرجى استخدام متصفح حديث أو تحديث متصفحك.");
          }
        }

        updateTime = () => {
          const v = videoRef.current;
          if (!v) return;
          const now = v.currentTime || 0;
          if (Math.abs(now - (lastRenderedTimeRef.current || 0)) > 0.2) {
            lastRenderedTimeRef.current = now;
            setCurrentTime(now);
          }
          if (!duration && v.duration) setDuration(v.duration);
          try {
            const b = v.buffered;
            if (b && b.length) {
              const end = b.end(b.length - 1);
              const dur = duration || v.duration || 0;
              if (dur > 0) {
                const pct = Math.min(100, (end / dur) * 100);
                if (Math.abs(pct - (bufferedPercent || 0)) > 1)
                  setBufferedPercent(pct);
              }
            }
          } catch (e) {}
        };

        let lastRafTs = 0;
        const rafLoop = (ts) => {
          if (!videoRef.current) return;
          if (!lastRafTs || ts - lastRafTs > 250) {
            updateTime();
            lastRafTs = ts;
          }
          rafId = requestAnimationFrame(rafLoop);
        };
        rafId = requestAnimationFrame(rafLoop);
        videoRef.current?.addEventListener("timeupdate", updateTime);

        try {
          const saved = localStorage.getItem(`video-pos-${video._id}`);
          if (saved) {
            const t = parseFloat(saved);
            if (!isNaN(t) && videoRef.current) {
              videoRef.current.currentTime = t;
              updateTime();
            }
          }
        } catch (e) {}

        saveInt = setInterval(() => {
          try {
            const v = videoRef.current;
            if (!v || isNaN(v.currentTime)) return;
            const docHidden = (typeof document !== 'undefined' && document.hidden);
            const now = Date.now();
            // When the document is hidden or the video is paused, save less frequently
            // to reduce localStorage churn. Normal active saves occur every 5s.
            if ((docHidden || v.paused) && (now - (saveLastRef.current || 0) < 30000)) {
              return;
            }
            localStorage.setItem(`video-pos-${video._id}`, String(v.currentTime));
            saveLastRef.current = now;
          } catch (e) {}
        }, 5000);

        try {
          if (videoRef.current) {
            videoRef.current.volume = volume;
            videoRef.current.playbackRate = playbackRate;
          }
        } catch (e) {}

        scheduleHideControls(3000);
      } catch (err) {
        console.error("Initialization error:", err);
        setError("حدث خطأ عند تحضير المشغل. يرجى محاولة إعادة تحميل الصفحة");
        setLoading(false);
      }
    };

    initPlayer();

    return () => {
      if (hls) {
        try {
          hls.destroy();
        } catch (e) {}
      }
      if (videoRef.current) {
        videoRef.current.pause();
        videoRef.current.removeAttribute("src");
        try {
          videoRef.current.load();
        } catch (e) {}
        try {
          if (onPlaying && videoRef.current) videoRef.current.removeEventListener('playing', onPlaying);
        } catch (e) {}
      }
      if (saveInt) clearInterval(saveInt);
      if (rafId) cancelAnimationFrame(rafId);
      clearHideControls();
      videoRef.current?.removeEventListener("timeupdate", updateTime);
    };
  }, [video, shouldInit, safePlay, clearHideControls, scheduleHideControls, applyQualityToHls]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    
    let longPressTimer = null;
    let tapTimer = null;
    
    const handlePointerDown = (e) => {
      pointerTypeRef.current = e.pointerType;
      
      if (e.pointerType === 'touch') {
        setInteractionState(prev => ({
          ...prev,
          isTouchInteraction: true,
          isMouseInteraction: false,
          pendingTap: true
        }));
        
        try {
          if (!e.target || !e.target.closest || e.target.closest('.controls-button')) {
            longPressTimer = null;
          } else {
            longPressTimer = setTimeout(() => {
              startLongPress('pointer', { x: e.clientX, y: e.clientY });
            }, LONG_PRESS_THRESHOLD);
          }
        } catch (err) {
          longPressTimer = setTimeout(() => {
            startLongPress('pointer', { x: e.clientX, y: e.clientY });
          }, LONG_PRESS_THRESHOLD);
        }
        
        tapTimer = setTimeout(() => {
          setInteractionState(prev => ({
            ...prev,
            pendingTap: false
          }));
        }, MOBILE_TAP_TIMEOUT);
        
      } else if (e.pointerType === 'mouse') {
        setInteractionState(prev => ({
          ...prev,
          isMouseInteraction: true,
          isTouchInteraction: false,
          pendingTap: false
        }));
      }
      
      showControlsWithOptions({ immediate: true });
    };
    
    const handlePointerMove = (e) => {
      if (e.pointerType === 'mouse') {
        showControlsWithOptions({ immediate: true });
      }
    };
    
    const handlePointerUp = (e) => {
      if (longPressTimer) clearTimeout(longPressTimer);
      if (tapTimer) clearTimeout(tapTimer);
      
      if (longPressState.active) {
        e.preventDefault();
        e.stopPropagation();
        stopLongPress();
      } else if (e.pointerType === 'touch' && interactionState.pendingTap) {
        try {
          const btn = e.target && e.target.closest && e.target.closest('.controls-button');
          if (btn) {
            setShowControls(true);
            scheduleHideControls(MOBILE_HIDE_TIMEOUT);
            setInteractionState(prev => ({ ...prev, pendingTap: false }));
            return;
          }

          if (!showControls) {
            try {
              if (centerPlayRef.current) {
                const r = centerPlayRef.current.getBoundingClientRect();
                const PAD = Math.min(40, Math.max(12, Math.round(Math.min(r.width, r.height) * 0.25)));
                const left = r.left - PAD;
                const right = r.right + PAD;
                const top = r.top - PAD;
                const bottom = r.bottom + PAD;
                if (e.clientX >= left && e.clientX <= right && e.clientY >= top && e.clientY <= bottom) {
                  try { e.preventDefault(); e.stopPropagation(); } catch (ee) {}
                  togglePlayPauseImmediate();
                  setShowControls(true);
                  scheduleHideControls(MOBILE_HIDE_TIMEOUT);
                  setInteractionState(prev => ({ ...prev, pendingTap: false }));
                  return;
                }
              }
            } catch (e) {}
          }

          try { e.preventDefault(); e.stopPropagation(); } catch (ee) {}
          setShowControls(prev => {
            const next = !prev;
            if (next) {
              scheduleHideControls(MOBILE_HIDE_TIMEOUT);
            }
            return next;
          });
        } catch (err) {}
      } else if (e.pointerType === 'mouse') {
      }
      
      setInteractionState(prev => ({
        ...prev,
        pendingTap: false
      }));
    };
    
    const handleDoubleClick = (e) => {
      if (pointerTypeRef.current === 'mouse') {
        if (e.target && e.target.closest && e.target.closest('.controls-button')) return;
        if (e.target === videoRef.current || e.target === container) {
          e.preventDefault();
          toggleFullscreen();
        }
      }
    };
    
    container.addEventListener('pointerdown', handlePointerDown, { passive: true });
    container.addEventListener('pointermove', handlePointerMove, { passive: true });
    container.addEventListener('pointerup', handlePointerUp, { passive: false });
    container.addEventListener('dblclick', handleDoubleClick);
    
    return () => {
      container.removeEventListener('pointerdown', handlePointerDown);
      container.removeEventListener('pointermove', handlePointerMove);
      container.removeEventListener('pointerup', handlePointerUp);
      container.removeEventListener('dblclick', handleDoubleClick);
      
      if (longPressTimer) clearTimeout(longPressTimer);
      if (tapTimer) clearTimeout(tapTimer);
    };
  }, [
    interactionState.pendingTap,
    longPressState.active,
    togglePlayPause,
    toggleFullscreen,
    showControlsWithOptions,
    startLongPress,
    stopLongPress,
    scheduleHideControls
  ]);
  
  // Touch long-press handlers for empty space (mobile)
  const handleTouchStart = useCallback((e) => {
    try {
      if (!isTouchInput.current) return;
      
      const target = e.target;
      const isControlsElement = target.closest('button') || 
                                target.closest('[role="button"]') || 
                                target.closest('input') || 
                                target.closest('[role="slider"]') ||
                                target !== videoRef.current;
      
      if (isControlsElement) return;
      
      const touch = e.touches[0];
      const touchStartTime = Date.now();
      
      // Start long-press timer
      const timer = setTimeout(() => {
        try {
          // Long-press detected - start double speed
          startDoubleSpeed();
          showControlsWithOptions({ immediate: true, extendTimeout: false });
          
          // Show haptic feedback
          if ('vibrate' in navigator) {
            try {
              navigator.vibrate(50); // Short haptic feedback
            } catch (vibErr) {}
          }
          
          pointerLongActiveRef.current = true;
        } catch (err) {}
      }, LONG_PRESS_THRESHOLD);
      
      // Store timer in ref for cleanup
      pointerLongPressTimerRef.current = {
        timer,
        startTime: touchStartTime,
        startX: touch.clientX,
        startY: touch.clientY
      };
    } catch (err) {}
  }, [startDoubleSpeed, showControlsWithOptions]);

  const handleTouchMove = useCallback((e) => {
    try {
      if (!pointerLongPressTimerRef.current) return;
      
      const touch = e.touches[0];
      const { startX, startY } = pointerLongPressTimerRef.current;
      
      // Check if moved too much (cancel long-press)
      const dx = Math.abs(touch.clientX - startX);
      const dy = Math.abs(touch.clientY - startY);
      const threshold = 15; // pixels
      
      if (dx > threshold || dy > threshold) {
        clearTimeout(pointerLongPressTimerRef.current.timer);
        pointerLongPressTimerRef.current = null;
        
        if (pointerLongActiveRef.current) {
          stopDoubleSpeed();
          pointerLongActiveRef.current = false;
        }
      }
    } catch (err) {}
  }, [stopDoubleSpeed]);

  const handleTouchEnd = useCallback((e) => {
    try {
      if (pointerLongPressTimerRef.current) {
        clearTimeout(pointerLongPressTimerRef.current.timer);
        pointerLongPressTimerRef.current = null;
      }
      
      if (pointerLongActiveRef.current) {
        stopDoubleSpeed();
        pointerLongActiveRef.current = false;
        scheduleHideControls(1000);
      }
    } catch (err) {}
  }, [stopDoubleSpeed, scheduleHideControls]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.code === 'Space') {
        e.preventDefault();
        
        if (isTouchInput.current) return;
        
        if (e.repeat) {
          if (!spaceLongActiveRef.current) {
            spaceLongActiveRef.current = true;
            startDoubleSpeed();
            showControlsWithOptions({ immediate: true, extendTimeout: false });
          }
        } else {
          togglePlayPause();
        }
      }
    };
    
    const handleKeyUp = (e) => {
      if (e.code === 'Space' && spaceLongActiveRef.current) {
        spaceLongActiveRef.current = false;
        stopDoubleSpeed();
        scheduleHideControls(1000);
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [togglePlayPause, startDoubleSpeed, stopDoubleSpeed, showControlsWithOptions, scheduleHideControls]);

  useEffect(() => {
    if (showControls) {
      scheduleHideControls();
    } else {
      clearHideControls();
    }
    return () => clearHideControls();
  }, [showControls, qualityMenuOpen, speedMenuOpen, settingsMenuOpen, scheduleHideControls, clearHideControls]);

  useEffect(() => {
    if (error) {
      setShowErrorOverlay(false);
      if (errorTimerRef.current) clearTimeout(errorTimerRef.current);
      errorTimerRef.current = setTimeout(() => {
        try {
          if (error) setShowErrorOverlay(true);
        } catch (e) {}
      }, 1200);
    } else {
      if (errorTimerRef.current) {
        clearTimeout(errorTimerRef.current);
        errorTimerRef.current = null;
      }
      setShowErrorOverlay(false);
    }
    return () => {
      if (errorTimerRef.current) {
        clearTimeout(errorTimerRef.current);
        errorTimerRef.current = null;
      }
    };
  }, [error, isPlaying]);

  useEffect(() => {
    return () => {
      if (errorSetDelayRef.current) {
        try { clearTimeout(errorSetDelayRef.current); } catch (e) {}
        errorSetDelayRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (!isFullscreen) {
      setFullscreenBottomInset(0);
      return;
    }
    const computeInset = () => {
      try {
        const vvh = (window.visualViewport && window.visualViewport.height) || window.innerHeight;
        const inset = Math.max(0, window.innerHeight - vvh) || 0;
        setFullscreenBottomInset(inset);

        try {
          const container = containerRef.current;
          if (container) {
            if (isFullscreen) {
              const heightPx = Math.max(0, vvh);
              container.style.height = `${heightPx}px`;
              container.style.maxHeight = `${heightPx}px`;
            } else {
              container.style.removeProperty('height');
              container.style.removeProperty('max-height');
            }
          }
        } catch (e) {}
      } catch (e) {
        setFullscreenBottomInset(0);
      }
    };

    computeInset();
    window.addEventListener("resize", computeInset);
    if (window.visualViewport && window.visualViewport.addEventListener) {
      window.visualViewport.addEventListener("resize", computeInset);
    }
    return () => {
      window.removeEventListener("resize", computeInset);
      if (window.visualViewport && window.visualViewport.removeEventListener) {
        window.visualViewport.removeEventListener("resize", computeInset);
      }
      try {
        const container = containerRef.current;
        if (container) {
          container.style.removeProperty('height');
          container.style.removeProperty('max-height');
        }
      } catch (e) {}
    };
  }, [isFullscreen]);

  useEffect(() => {
    try {
      if (videoRef.current) videoRef.current.volume = volume;
      localStorage.setItem("video-volume", String(volume));
      if (volume > 0) prevVolumeRef.current = volume;
    } catch (e) {
      console.warn("Volume sync error:", e);
    }
  }, [volume]);

  useEffect(() => {
    try {
      if (videoRef.current) videoRef.current.playbackRate = playbackRate;
      localStorage.setItem("video-rate", String(playbackRate));
    } catch (e) {
      console.warn("Playback rate sync error:", e);
    }
  }, [playbackRate]);

  useEffect(() => {
    const onKey = (e) => {
      if (!videoRef.current) return;
      const v = videoRef.current;
      
      if (e.code === 'Space') return;
      
      switch (e.code) {
        case "ArrowRight":
          e.preventDefault();
          v.currentTime = Math.min(v.duration || 0, v.currentTime + 5);
          setCurrentTime(v.currentTime);
          showActionFeedbackPos(Icons.Forward10, "+5s", 800, 'right');
          break;
        case "ArrowLeft":
          e.preventDefault();
          v.currentTime = Math.max(0, v.currentTime - 5);
          setCurrentTime(v.currentTime);
          showActionFeedbackPos(Icons.Replay10, "-5s", 800, 'left');
          break;
        case "ArrowUp":
          e.preventDefault();
          const upVol = Math.min(1, Math.round((v.volume + 0.05) * 100) / 100);
          v.volume = upVol;
          setVolume(upVol);
          break;
        case "ArrowDown":
          e.preventDefault();
          const downVol = Math.max(0, Math.round((v.volume - 0.05) * 100) / 100);
          v.volume = downVol;
          setVolume(downVol);
          break;
        case "KeyF":
          e.preventDefault();
          toggleFullscreen();
          break;
        case "KeyM":
          e.preventDefault();
          if (v.volume > 0) {
            prevVolumeRef.current = v.volume;
            setVolume(0);
          } else {
            const restore = prevVolumeRef.current > 0 ? prevVolumeRef.current : 1;
            setVolume(restore);
          }
          break;
        case "Escape":
          if (document.fullscreenElement) {
            e.preventDefault();
            toggleFullscreen();
          }
          break;
      }
      
      setShowControls(true);
      scheduleHideControls(3000);
    };

    window.addEventListener("keydown", onKey);
    
    const handleFullscreenChange = () => {
      const isFs = !!document.fullscreenElement;

      try {
        fullscreenTransitionRef.current = true;
        
        // تعطيل freeze الفيديو تماماً - لا نحفظ ولا نعيد التشغيل
        if (hlsFreezeTimeoutRef.current) {
          clearTimeout(hlsFreezeTimeoutRef.current);
          hlsFreezeTimeoutRef.current = null;
        }
      } catch (e) {}

      setIsFullscreen(isFs);
      setShowControls(true);
      clearHideControls();

      // إنهاء الانتقال بعد وقت كافٍ لتجنب إعادة تحميل البث
      setTimeout(() => {
        try { fullscreenTransitionRef.current = false; } catch (e) {}
      }, 300);

      // تحديث حجم الفيديو فقط عند الخروج من ملء الشاشة
      if (!isFs) {
        setTimeout(updateVideoSizing, 50);
        scheduleHideControls(3000);
      }
    };
    document.addEventListener("fullscreenchange", handleFullscreenChange);

    if ("mediaSession" in navigator && video) {
      try {
        navigator.mediaSession.metadata = new window.MediaMetadata({
          title: video.title || "Lecture",
          artist: video.instructor?.name || "",
        });
        navigator.mediaSession.setActionHandler("play", () => {
          safePlay();
          setShowControls(true);
        });
        navigator.mediaSession.setActionHandler("pause", () => {
          videoRef.current && videoRef.current.pause();
          setShowControls(true);
        });
        navigator.mediaSession.setActionHandler("seekbackward", (details) => {
          const skip = (details && details.seekOffset) || 10;
          if (videoRef.current) {
            videoRef.current.currentTime = Math.max(0, videoRef.current.currentTime - skip);
            setCurrentTime(videoRef.current.currentTime);
          }
        });
        navigator.mediaSession.setActionHandler("seekforward", (details) => {
          const skip = (details && details.seekOffset) || 10;
          if (videoRef.current) {
            videoRef.current.currentTime = Math.min(videoRef.current.duration || 0, videoRef.current.currentTime + skip);
            setCurrentTime(videoRef.current.currentTime);
          }
        });
      } catch (e) {}
    }

    return () => {
      window.removeEventListener("keydown", onKey);
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
    };
  }, [video, togglePlayPause, toggleFullscreen, safePlay, scheduleHideControls, showActionFeedbackPos, clearHideControls, updateVideoSizing]);

  useEffect(() => {
    return () => {
      try {
        feedbackTimersRef.current.forEach((t) => clearTimeout(t));
        feedbackTimersRef.current.clear();
      } catch (e) {}
    };
  }, []);

  useEffect(() => {
    try {
      if (isLongPressActive || longPressState.active || spaceLongActiveRef.current) {
        setShowControls(true);
        clearHideControls();
      }
    } catch (e) {}
  }, [isLongPressActive, longPressState.active, clearHideControls]);

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    const onPlay = () => setIsPlaying(true);
    const onPause = () => setIsPlaying(false);
    v.addEventListener("play", onPlay);
    v.addEventListener("pause", onPause);
    return () => {
      v.removeEventListener("play", onPlay);
      v.removeEventListener("pause", onPause);
    };
  }, []);

  useEffect(() => {
    const onDocClick = (e) => {
      if (ignoreDocClickRef.current) return;
      
      // Close menus if clicking outside in fullscreen mode
      if (isFullscreen) {
        // Check if click is on a menu or button
        if (qualityMenuOpen && qualityRef.current && !qualityRef.current.contains(e.target)) {
          setQualityMenuOpen(false);
        }
        if (speedMenuOpen && speedRef.current && !speedRef.current.contains(e.target)) {
          setSpeedMenuOpen(false);
        }
        if (settingsMenuOpen) {
          const clickedInsideButton = settingsRef.current && settingsRef.current.contains(e.target);
          const clickedInsideMenu = settingsMenuRef.current && settingsMenuRef.current.contains(e.target);
          if (!clickedInsideButton && !clickedInsideMenu) {
            setSettingsMenuOpen(false);
          }
        }
        return;
      }
      
      if (qualityMenuOpen && qualityRef.current && !qualityRef.current.contains(e.target)) {
        setQualityMenuOpen(false);
      }
      if (speedMenuOpen && speedRef.current && !speedRef.current.contains(e.target)) {
        setSpeedMenuOpen(false);
      }
      if (settingsMenuOpen) {
        const clickedInsideButton = settingsRef.current && settingsRef.current.contains(e.target);
        const clickedInsideMenu = settingsMenuRef.current && settingsMenuRef.current.contains(e.target);
        if (!clickedInsideButton && !clickedInsideMenu) {
          setSettingsMenuOpen(false);
        }
      }
    };
    const onEsc = (e) => {
      if (e.key === "Escape") {
        setQualityMenuOpen(false);
        setSpeedMenuOpen(false);
        setSettingsMenuOpen(false);
      }
    };
    document.addEventListener("click", onDocClick);
    document.addEventListener("keydown", onEsc);
    return () => {
      document.removeEventListener("click", onDocClick);
      document.removeEventListener("keydown", onEsc);
    };
  }, [qualityMenuOpen, speedMenuOpen, settingsMenuOpen, isFullscreen]);

  useEffect(() => {
    if (!settingsMenuOpen) return;
    const onClose = (e) => {
      try {
        if (e && e.target) {
          if (settingsRef.current && settingsRef.current.contains(e.target)) return;
          if (settingsMenuRef.current && settingsMenuRef.current.contains(e.target)) return;
        }
      } catch (err) {}
      setSettingsMenuOpen(false);
      setSettingsMenuPos(null);
    };
    window.addEventListener('resize', onClose);
    window.addEventListener('scroll', onClose, true);
    return () => {
      window.removeEventListener('resize', onClose);
      window.removeEventListener('scroll', onClose, true);
    };
  }, [settingsMenuOpen]);

  useEffect(() => {
    updateVideoSizing();
  }, [updateVideoSizing]);

  useEffect(() => {
    // تخطي تطبيق الجودة أثناء الانتقال بين أوضاع العرض
    if (fullscreenTransitionRef.current) return;
    
    if (hlsRef.current && currentQuality) {
      applyQualityToHls(hlsRef.current, currentQuality);
    }
  }, [currentQuality, applyQualityToHls]);

  useEffect(() => {
    const handleResize = () => {
      updateVideoSizing();
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [updateVideoSizing]);

  const Icons = useMemo(() => ({
    Play: () => (
      <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
        <path d="M8 5V19L19 12L8 5Z" className="drop-shadow-lg" />
      </svg>
    ),
    Replay10: () => (
      <svg className="w-5 h-5 sm:w-6 sm:h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <circle cx="12" cy="12" r="9" strokeWidth="1.6" fill="none" className="opacity-80" />
        <path d="M8.5 9.5L5.5 12L8.5 14.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
        <path d="M9.5 7.5A6 6 0 0 1 17 12" strokeLinecap="round" fill="none" strokeWidth="1.4" />
      </svg>
    ),
    Pause: () => (
      <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
        <rect x="6" y="5" width="4" height="14" rx="1" className="drop-shadow-lg" />
        <rect x="14" y="5" width="4" height="14" rx="1" className="drop-shadow-lg" />
      </svg>
    ),
    Forward10: () => (
      <svg className="w-5 h-5 sm:w-6 sm:h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <circle cx="12" cy="12" r="9" strokeWidth="1.6" fill="none" className="opacity-80" />
        <path d="M15.5 9.5L18.5 12L15.5 14.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
        <path d="M14.5 7.5A6 6 0 0 0 7 12" strokeLinecap="round" fill="none" strokeWidth="1.4" />
      </svg>
    ),
    Settings: () => (
      <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
        <path d="M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58a.49.49 0 0 0 .12-.61l-1.92-3.32c-.12-.22-.37-.29-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54a.484.484 0 0 0-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.05.3-.09.63-.09.94s.02.64.07.94l-2.03 1.58a.49.49 0 0 0-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z" />
      </svg>
    ),
    VolumeOff: () => (
      <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
        <path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27l7.73 7.73V13h-4v4h4v-2.73l4.52 4.52C14.42 18.04 13.83 18.46 13 18.7v2.77c1.38-.32 2.63-.95 3.68-1.84L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z" />
      </svg>
    ),
    VolumeLow: () => (
      <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
        <path d="M7 9v6h4l5 5V4l-5 5H7z" />
      </svg>
    ),
    VolumeHigh: () => (
      <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
        <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z" />
      </svg>
    ),
    Fullscreen: () => (
      <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
        <path d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z" />
      </svg>
    ),
    FullscreenExit: () => (
      <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
        <path d="M5 16h3v3h2v-5H5v2zm3-8H5v2h5V5H8v3zm6 11h2v-3h3v-2h-5v5zm2-11V5h-2v5h5V8h-3z" />
      </svg>
    ),
    Quality: () => (
      <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
        <path d="M19 4H5a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2zm0 14H5V6h14v12z" />
        <path d="M7.5 13.5h2v2h-2z" />
        <path d="M11.5 13.5h2v2h-2z" />
        <path d="M15.5 13.5h2v2h-2z" />
      </svg>
    ),
    Speed: () => (
      <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
        <path d="M20.38 8.57l-6.46-6.37c-.2-.19-.56-.2-.76 0L6.5 3.5C5.67 3.5 5 4.17 5 5v15c0 .83.67 1.5 1.5 1.5h11c.83 0 1.5-.67 1.5-1.5V9.3c0-.26-.07-.52-.24-.73l-2.38-2zm-8.38 9c-1.93 0-3.5-1.57-3.5-3.5s1.57-3.5 3.5-3.5 3.5 1.57 3.5 3.5-1.57 3.5-3.5 3.5z" />
        <circle cx="12" cy="14" r="2.5" fill="#fff" />
      </svg>
    ),
    ChevronDown: () => (
      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
        <path d="M7.41 8.59L12 13.17l4.59-4.58L18 10l-6 6-6-6 1.41-1.41z" />
      </svg>
    ),
    PlayArrow: () => (
      <svg className="w-10 h-10 sm:w-12 sm:h-12" viewBox="0 0 24 24" fill="currentColor">
        <path d="M8 5v14l11-7z" className="drop-shadow-2xl" />
      </svg>
    ),
    PauseCircle: () => (
      <svg className="w-10 h-10 sm:w-12 sm:h-12" viewBox="0 0 24 24" fill="currentColor">
        <path d="M9 16h2V8H9v8zm3-14C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm1-4h2V8h-2v8z" />
      </svg>
    ),
  }), []);

  const progressPct = duration ? (currentTime / duration) * 100 : 0;

  return (
    <div className="video-player-wrapper relative w-full">
      <div
        className={`video-player-container relative w-full bg-gradient-to-br from-gray-900 via-gray-950 to-black overflow-hidden ${
          isFullscreen 
            ? "fixed inset-0 z-50" 
            : "aspect-video max-h-[70vh] shadow-2xl rounded-2xl"
        } ${showControls ? "" : "cursor-none"}`}
        ref={containerRef}
        style={isFullscreen ? { 
          paddingTop: 'env(safe-area-inset-top, 0px)',
          paddingBottom: `calc(env(safe-area-inset-bottom, 0px) + ${fullscreenBottomInset}px)`,
          paddingLeft: 'env(safe-area-inset-left, 0px)',
          paddingRight: 'env(safe-area-inset-right, 0px)'
        } : undefined}
        onClick={(e) => {
          try {
            if (isFullscreen) {
              e.stopPropagation();
              const target = e.target;
              
              if (target !== videoRef.current && 
                  (target.closest('button') || target.closest('[role="button"]') || 
                   target.closest('[role="slider"]') || target.closest('input'))) {
                return;
              }
              
              if (!showControls) {
                setShowControls(true);
                scheduleHideControls(3000);
              } else {
                setShowControls(false);
              }
              return;
            }

            const cx = e.clientX;
            const cy = e.clientY;

            if (!showControls) {
              if (centerPlayRef.current) {
                const r = centerPlayRef.current.getBoundingClientRect();
                const PAD = Math.min(40, Math.max(12, Math.round(Math.min(r.width, r.height) * 0.25)));
                const left = r.left - PAD;
                const right = r.right + PAD;
                const top = r.top - PAD;
                const bottom = r.bottom + PAD;
                if (cx >= left && cx <= right && cy >= top && cy <= bottom) {
                  togglePlayPauseImmediate();
                  return;
                }
              }

              if (fsButtonRef.current) {
                const r2 = fsButtonRef.current.getBoundingClientRect();
                if (cx >= r2.left && cx <= r2.right && cy >= r2.top && cy <= r2.bottom) {
                  toggleFullscreen();
                  setShowControls(true);
                  scheduleHideControls(3000);
                  return;
                }
              }

              setShowControls(true);
              scheduleHideControls(3000);
              return;
            }

            if (pointerLongSuppressClickRef.current) {
              try { pointerLongSuppressClickRef.current = false; } catch (e) {}
              return;
            }

            if (e.target === videoRef.current) {
              setShowControls((prev) => {
                const next = !prev;
                if (next) scheduleHideControls(3000);
                return next;
              });
            }
          } catch (err) {}
        }}
        onMouseLeave={() => {
          if (hideControlsTimeoutRef.current) clearTimeout(hideControlsTimeoutRef.current);
          hideControlsTimeoutRef.current = setTimeout(() => setShowControls(false), 3000);
        }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        <video
          ref={videoRef}
          controls={false}
          poster={
            video?.poster ||
            video?.thumbnail?.lqip ||
            video?.thumbnail?.small ||
            ""
          }
          playsInline
          preload="metadata"
          onWaiting={() => {
            try {
              // تجاهل loading أثناء الانتقال بين أوضاع العرض
              if (fullscreenTransitionRef.current) return;
            } catch (e) {}
            setLoading(true);
          }}
          onCanPlay={() => setLoading(false)}
          onCanPlayThrough={() => setLoading(false)}
          onLoadedMetadata={(e) => {
            try {
              const d = e?.target?.duration;
              if ((!duration || duration === 0) && d && d > 0) setDuration(d);
              setLoading(false);
            } catch (err) {}
          }}
          className="video-player w-full h-full object-contain"
        ></video>

        {video?.title && (
          <div
            className={`video-title-overlay absolute left-2 xs:left-3 sm:left-4 right-2 xs:right-3 sm:right-4 top-2 xs:top-3 sm:top-4 z-50 transition-all duration-300 transform ${
              showControls ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-4 pointer-events-none"
            }`}
            style={isFullscreen ? { top: `calc(env(safe-area-inset-top, 0px) + 1rem)` } : undefined}
          >
            <div className="mx-auto max-w-full bg-gradient-to-r from-black/70 via-black/50 to-transparent backdrop-blur-lg text-white/95 rounded-lg xs:rounded-xl sm:rounded-xl px-2.5 xs:px-3 sm:px-4 py-1.5 xs:py-2 sm:py-3 text-xs xs:text-sm sm:text-base font-bold truncate shadow-2xl border border-white/10">
              <div className="flex items-center gap-1.5 xs:gap-2">
                <div className="w-1.5 h-1.5 xs:w-2 xs:h-2 bg-red-500 rounded-full animate-pulse flex-shrink-0"></div>
                {video.title}
              </div>
            </div>
          </div>
        )}

        {(isPendingLongPress || isLongPressActive) && (
          <div className="absolute inset-0 z-[100000] bg-gradient-to-br from-red-500/5 to-cyan-500/5" style={{ pointerEvents: 'auto' }} />
        )}

        {actionFeedback.visible && actionFeedback.position === 'center' && (
          <div className="hidden sm:flex absolute inset-0 items-center justify-center pointer-events-none z-40">
            <div className="feedback-center flex flex-col items-center gap-3 bg-gradient-to-br from-black/70 to-gray-900/70 text-white/95 px-6 py-4 rounded-2xl backdrop-blur-xl border border-white/20 shadow-2xl animate-scale-in">
              <div className="text-4xl bg-gradient-to-r from-red-500 to-cyan-500 bg-clip-text text-transparent">
                {actionFeedback.icon ? actionFeedback.icon() : null}
              </div>
              <div className="text-lg font-bold tracking-wide">{actionFeedback.text}</div>
            </div>
          </div>
        )}

        {actionFeedback.visible && actionFeedback.position === 'top' && (
          <div className="feedback-top absolute left-1/2 transform -translate-x-1/2 pointer-events-none z-50" style={{ top: isTouchInput.current ? 'auto' : '25%', bottom: isTouchInput.current ? '6rem' : 'auto' }}>
            <div className="flex flex-col items-center gap-1 xs:gap-1.5 sm:gap-2 bg-gradient-to-br from-black/70 to-gray-900/70 text-white/95 px-2 xs:px-3 sm:px-4 py-1.5 xs:py-2 sm:py-3 rounded-lg xs:rounded-xl sm:rounded-xl backdrop-blur-xl border border-white/20 shadow-2xl animate-scale-in">
              <div className="text-xl xs:text-2xl sm:text-3xl">{actionFeedback.icon ? actionFeedback.icon() : null}</div>
              <div className="text-xs xs:text-xs sm:text-sm font-bold tracking-wide">{actionFeedback.text}</div>
            </div>
          </div>
        )}

        {actionFeedback.visible && actionFeedback.position === 'left' && (
          <div className="hidden sm:block feedback-left absolute top-1/2 left-8 transform -translate-y-1/2 pointer-events-none z-40 animate-slide-in-left">
            <div className="flex flex-col items-center gap-2 bg-gradient-to-br from-black/70 to-gray-900/70 text-white/95 px-4 py-3 rounded-xl backdrop-blur-xl border border-white/20 shadow-2xl">
              <div className="text-3xl">{actionFeedback.icon ? actionFeedback.icon() : null}</div>
              <div className="text-sm font-bold tracking-wide">{actionFeedback.text}</div>
            </div>
          </div>
        )}

        {actionFeedback.visible && actionFeedback.position === 'right' && (
          <div className="hidden sm:block feedback-right absolute top-1/2 right-8 transform -translate-y-1/2 pointer-events-none z-40 animate-slide-in-right">
            <div className="flex flex-col items-center gap-2 bg-gradient-to-br from-black/70 to-gray-900/70 text-white/95 px-4 py-3 rounded-xl backdrop-blur-xl border border-white/20 shadow-2xl">
              <div className="text-3xl">{actionFeedback.icon ? actionFeedback.icon() : null}</div>
              <div className="text-sm font-bold tracking-wide">{actionFeedback.text}</div>
            </div>
          </div>
        )}

        {seekFeedback.visible && !actionFeedback.visible && (
          <div className={`seek-feedback absolute top-1/2 transform -translate-y-1/2 ${seekFeedback.type === "forward" ? "right-8" : "left-8"} pointer-events-none z-40 animate-slide-in-${seekFeedback.type === "forward" ? "right" : "left"}`}>
            <div className="flex flex-col items-center gap-2 bg-gradient-to-br from-black/70 to-gray-900/70 text-white/95 px-4 py-3 rounded-xl backdrop-blur-xl border border-white/20 shadow-2xl">
              <div className="text-3xl">
                {seekFeedback.type === "forward" ? <Icons.Forward10 /> : <Icons.Replay10 />}
              </div>
              <div className="text-sm font-bold tracking-wide">{seekFeedback.time}</div>
            </div>
          </div>
        )}

        {rateFeedback.visible && !actionFeedback.visible && (
          <div className="hidden sm:flex rate-feedback absolute inset-0 items-center justify-center pointer-events-none z-40">
            <div className="flex flex-col items-center gap-2 bg-gradient-to-br from-black/70 to-gray-900/70 text-white/95 px-6 py-4 rounded-2xl backdrop-blur-xl border border-white/20 shadow-2xl animate-scale-in">
              <div className="text-3xl font-bold bg-gradient-to-r from-red-500 to-cyan-500 bg-clip-text text-transparent">{rateFeedback.rate}x</div>
              <div className="text-sm font-medium opacity-80">سرعة التشغيل</div>
            </div>
          </div>
        )}



        {error && showErrorOverlay && (
          <div className="error-overlay absolute inset-0 flex items-center justify-center bg-gradient-to-br from-black/95 via-gray-900/95 to-black/95 backdrop-blur-xl animate-fade-in" style={{ zIndex: 2147483647, pointerEvents: 'auto' }}>
            <div className="text-center p-2 xs:p-3 sm:p-6 lg:p-8 bg-gradient-to-br from-red-900/30 to-gray-900 rounded-lg xs:rounded-2xl sm:rounded-3xl max-w-xs xs:max-w-sm border border-red-600/40 shadow-2xl">
              <div className="text-red-300 text-lg xs:text-2xl sm:text-3xl mb-2 xs:mb-3 sm:mb-6 font-bold flex items-center justify-center gap-1 xs:gap-2 sm:gap-3">
                <span className="text-2xl xs:text-3xl sm:text-4xl animate-pulse">⚠️</span> 
              </div>
              <h2 className="text-white text-sm xs:text-lg sm:text-xl font-bold mb-1 xs:mb-2 sm:mb-3">حدث خطأ</h2>
              <p className="text-red-200 text-xs xs:text-sm sm:text-base mb-3 xs:mb-4 sm:mb-6 leading-relaxed">
                {error}
              </p>
              <button
                onClick={retryPlayback}
                className="w-full px-3 xs:px-4 sm:px-6 py-1.5 xs:py-2 sm:py-3 bg-gradient-to-r from-red-600 via-orange-500 to-red-700 text-white rounded-md xs:rounded-lg sm:rounded-xl transition-all duration-300 shadow-lg hover:shadow-red-500/25 active:scale-95 font-bold text-xs xs:text-sm sm:text-base"
              >
                🔄 إعادة المحاولة
              </button>
              <p className="text-white/50 text-xs mt-2 xs:mt-3 sm:mt-4">
                إذا استمرت المشكلة، جدد الصفحة
              </p>
            </div>
          </div>
        )}

        {showControls && (
          <div className="center-controls absolute inset-0 flex items-center justify-center pointer-events-none z-[99999] animate-fade-in">
            <div className="flex items-center gap-1 xs:gap-2 sm:gap-3 md:gap-5 lg:gap-8 pointer-events-auto">
              <button
                type="button"
                aria-label="تأخير 5 ث"
                onClick={() => {
                  const v = videoRef.current;
                  if (!v) return;
                  v.currentTime = Math.max(0, (v.currentTime || 0) - 5);
                  setCurrentTime(v.currentTime);
                  showActionFeedbackPos(Icons.Replay10, "-5s", 800, 'left');
                }}
                className="controls-button center-btn-left flex items-center justify-center w-7 h-7 xs:w-8 xs:h-8 sm:w-10 sm:h-10 md:w-12 md:h-12 lg:w-14 lg:h-14 rounded-full bg-gradient-to-br from-gray-900/80 to-black/80 text-white shadow-md xs:shadow-lg transition-all duration-300 hover:shadow-cyan-500/25 active:scale-95 backdrop-blur-sm"
              >
                <Icons.Replay10 />
              </button>

              <button
                type="button"
                aria-label={loading ? "جارٍ التحميل" : (isPlaying ? "إيقاف" : "تشغيل")}
                onClick={(e) => {
                  try {
                    if (loading) return;
                    togglePlayPauseImmediate();
                  } catch (err) {}
                }}
                ref={centerPlayRef}
                className={`controls-button center-btn-play flex items-center justify-center w-10 h-10 xs:w-12 xs:h-12 sm:w-14 sm:h-14 md:w-18 md:h-18 lg:w-20 lg:h-20 rounded-full ${
                  loading ? "bg-gradient-to-br from-gray-800 to-black" : "bg-gradient-to-br from-red-600 via-red-500 to-orange-500"
                } text-white shadow-xl xs:shadow-2xl transition-all duration-300 hover:shadow-red-500/50 active:scale-95 z-[99999] relative overflow-hidden group`}
                disabled={loading}
              >
                {loading ? (
                  <svg className="w-6 h-6 xs:w-7 xs:h-7 sm:w-8 sm:h-8 md:w-9 md:h-9 text-white animate-spin" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                  </svg>
                ) : (isPlaying ? <Icons.PauseCircle /> : <Icons.PlayArrow />)}
                
                <div className={`absolute inset-0 rounded-full ${
                  isPlaying ? "bg-gradient-to-r from-red-500/20 to-orange-500/20" : "bg-gradient-to-r from-red-600/20 to-cyan-500/20"
                } blur-xl group-hover:blur-2xl transition-all duration-500`}></div>
              </button>

              <button
                type="button"
                aria-label="تقديم 5 ث"
                onClick={() => {
                  const v = videoRef.current;
                  if (!v) return;
                  v.currentTime = Math.min((v.duration || 0), (v.currentTime || 0) + 5);
                  setCurrentTime(v.currentTime);
                  showActionFeedbackPos(Icons.Forward10, "+5s", 800, 'right');
                }}
                className="controls-button center-btn-right flex items-center justify-center w-7 h-7 xs:w-8 xs:h-8 sm:w-10 sm:h-10 md:w-12 md:h-12 lg:w-14 lg:h-14 rounded-full bg-gradient-to-br from-gray-900/80 to-black/80 text-white shadow-md xs:shadow-lg transition-all duration-300 hover:shadow-cyan-500/25 active:scale-95 backdrop-blur-sm z-[99999]"
              >
                <Icons.Forward10 />
              </button>
            </div>
          </div>
        )}

        <div
          className={`unified-controls-background absolute left-0 right-0 bottom-16 transition-all duration-300 transform z-[99998] bg-gradient-to-t from-black/40 via-black/20 to-transparent backdrop-blur-sm ${
            showControls ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
          }`}
          style={isFullscreen ? { bottom: 0 } : { bottom: 0 }}
        />

        <div
          className={`progress-bar-container absolute left-0 right-0 transition-all duration-300 transform z-50 ${
            showControls ? "opacity-100 translate-y-0 pointer-events-auto" : "opacity-0 translate-y-4 pointer-events-none"
          }`}
          style={isFullscreen ? { bottom: `calc(3rem + env(safe-area-inset-bottom) + ${fullscreenBottomInset}px)` } : { bottom: isTouchInput.current ? '1rem' : '2.5rem' }}
        >
          <div className="flex items-center gap-0.5 xs:gap-0.5 sm:gap-1 px-0.5 xs:px-1 sm:px-1.5 md:px-2 lg:px-3 xl:px-4 py-0.5 xs:py-0.5 sm:py-1 md:py-1.5 lg:py-2 xl:py-3 w-full">
            <div className="text-white/90 font-bold text-xs xs:text-xs sm:text-xs md:text-sm bg-black/30 px-0.5 xs:px-1 sm:px-1.5 md:px-2 lg:px-3 py-0.5 xs:py-0.5 sm:py-0.5 md:py-0.5 lg:py-1 rounded-sm xs:rounded-sm sm:rounded-md whitespace-nowrap min-w-[55px] xs:min-w-[60px] sm:min-w-[70px] text-center flex-shrink-0">
              <span
                className="cursor-pointer select-none transition-all duration-200 hover:text-cyan-400"
                onClick={(e) => {
                  try {
                    e.preventDefault();
                    e.stopPropagation();
                    setShowRemaining((s) => !s);
                  } catch (err) {}
                }}
                title={showRemaining ? "اضغط لإظهار الوقت المنقضي" : "اضغط لإظهار الوقت المتبقي"}
              >
                {showRemaining && duration ? `-${formatTime(Math.max(0, duration - currentTime))}` : formatTime(currentTime)}
              </span>
              <span className="text-white/60 mx-0.5 xs:mx-0.5 sm:mx-0.5 font-medium text-xs hidden xs:inline">/ {formatTime(duration)}</span>
            </div>

            <div className="flex-1 relative min-w-[100px]">
              <div
                role="slider"
                aria-label="شريط التقدم"
                aria-valuemin={0}
                aria-valuemax={duration || 0}
                aria-valuenow={currentTime}
                tabIndex={0}
                ref={progressRef}
                className={`progress-bar relative cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 h-0.5 xs:h-1 sm:h-1.5 md:h-2 lg:h-2.5 xl:h-3 bg-gradient-to-r from-gray-800/40 to-gray-800/20 rounded-full shadow-inner overflow-visible group`}
                onClick={handleSeek}
                onMouseDown={handlePointerSeekStart}
                onMouseEnter={() => { setHoverProgress(true); }}
                onMouseLeave={() => { setHoverProgress(false); setHoverTime(null); }}
                onMouseMove={(e) => { handleProgressMouseMove && handleProgressMouseMove(e); }}
                onKeyDown={(e) => {
                  if (!duration || !videoRef.current) return;
                  switch (e.key) {
                    case "ArrowRight":
                      e.preventDefault();
                      videoRef.current.currentTime = Math.min(duration, videoRef.current.currentTime + 5);
                      setCurrentTime(videoRef.current.currentTime);
                      break;
                    case "ArrowLeft":
                      e.preventDefault();
                      videoRef.current.currentTime = Math.max(0, videoRef.current.currentTime - 5);
                      setCurrentTime(videoRef.current.currentTime);
                      break;
                    case "Home":
                      e.preventDefault();
                      videoRef.current.currentTime = 0;
                      setCurrentTime(0);
                      break;
                    case "End":
                      e.preventDefault();
                      videoRef.current.currentTime = duration;
                      setCurrentTime(duration);
                      break;
                  }
                }}
              >
                <div
                  className="absolute top-0 h-full bg-gradient-to-r from-gray-500/30 to-gray-400/30 rounded-full transition-all duration-500"
                  style={{
                    [isProgressRtl() ? "right" : "left"]: 0,
                    width: `${bufferedPercent || 0}%`,
                    zIndex: 0,
                  }}
                />

                <div
                  className={`absolute top-0 h-full rounded-full shadow-lg transition-all duration-300 ${
                    hoverProgress ? "bg-gradient-to-r from-red-500 via-cyan-500 to-blue-600" : "bg-gradient-to-r from-red-600 via-red-500 to-orange-500"
                  }`}
                  style={{
                    [isProgressRtl() ? "right" : "left"]: 0,
                    width: `${progressPct}%`,
                    zIndex: 1,
                  }}
                />

                <div
                  className={`progress-handle absolute top-1/2 -translate-y-1/2 cursor-pointer transition-all duration-300 rounded-full ${
                    hoverProgress ? "w-4 h-4 bg-white shadow-xl border-2 border-cyan-400" : "w-3 h-3 bg-white shadow-lg border-2 border-red-500"
                  } group-hover:w-4 group-hover:h-4`}
                  style={{
                    [isProgressRtl() ? "right" : "left"]: `${progressPct}%`,
                    transform: isProgressRtl() ? "translate(50%, -50%)" : "translate(-50%, -50%)",
                    zIndex: 2,
                  }}
                  aria-hidden
                />

                {hoverProgress && hoverTime !== null && (
                  <div
                    className="absolute bottom-full mb-3 pointer-events-none z-50 animate-fade-in"
                    style={{
                      [isProgressRtl() ? "right" : "left"]: `${hoverPosPct}%`,
                      transform: isProgressRtl() ? "translateX(50%)" : "translateX(-50%)",
                    }}
                  >
                    <div className="bg-gradient-to-br from-gray-950 via-gray-900 to-black text-white px-4 py-2.5 rounded-lg text-sm font-bold whitespace-nowrap shadow-2xl border border-white/30 backdrop-blur-xl">
                      <div className="flex items-center gap-2">
                        <svg className="w-4 h-4 text-cyan-400" fill="currentColor" viewBox="0 0 24 24">
                          <circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" strokeWidth="2"/>
                          <path d="M12 6v6l4 2.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                        </svg>
                        <span>{hoverTime || '00:00'}</span>
                      </div>
                      <div className="absolute top-full left-1/2 transform -translate-x-1/2 w-2 h-2 bg-gradient-to-b from-gray-900 to-black border border-white/30 rounded-full" style={{ marginTop: '-5px' }}></div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        <div
          className={`bottom-controls-container absolute left-0 right-0 bottom-0 px-0.5 xs:px-1 sm:px-2 md:px-2.5 lg:px-3 xl:px-4 transition-all duration-300 transform z-[99999] ${
            showControls ? "opacity-100 translate-y-0 pointer-events-auto" : "opacity-0 translate-y-4 pointer-events-none"
          }`}
        >
          <div className="flex items-center justify-between gap-0.5 xs:gap-0.5 sm:gap-1 md:gap-1.5 lg:gap-2.5 xl:gap-4 w-full">
            <div className="flex items-center gap-0.5 xs:gap-0.5 sm:gap-0.5 md:gap-1 lg:gap-1.5 xl:gap-2 justify-start flex-1 min-w-0">
              <button
                onClick={togglePlayPauseImmediate}
                  className="play-pause-btn controls-button flex items-center justify-center rounded-lg sm:rounded-xl bg-gradient-to-br from-gray-900/90 to-black/90 text-white px-2 sm:px-3 py-2 sm:py-3 shadow-2xl border border-white/10 transition-all duration-300 hover:shadow-cyan-500/25 active:scale-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 backdrop-blur-sm"
                aria-label={isPlaying ? "إيقاف" : "تشغيل"}
              >
                {isPlaying ? <Icons.Pause /> : <Icons.Play />}
              </button>

              <div 
                className="volume-control-container flex items-center gap-0.5 xs:gap-0.5 sm:gap-0.5 md:gap-1 lg:gap-1.5 xl:gap-2 bg-gradient-to-br from-gray-900 to-black rounded-lg sm:rounded-xl px-2 sm:px-3 py-2 sm:py-3 border border-white/10 flex-shrink-0 transition-all duration-200 hover:border-cyan-400/40"
                onMouseEnter={() => {
                  if (!isTouchInput.current) setShowVolumeSlider(true);
                  disablePageScrollWhileInteracting();
                }}
                onMouseLeave={() => {
                  if (!isTouchInput.current) setShowVolumeSlider(false);
                  enablePageScrollAfterInteracting();
                }}
              >
                <button
                  onClick={() => {
                    if (volume > 0) {
                      prevVolumeRef.current = volume;
                      setVolume(0);
                    } else {
                      setVolume(prevVolumeRef.current > 0 ? prevVolumeRef.current : 1);
                    }
                  }}
                  className={`volume-btn controls-button flex items-center justify-center text-white transition-transform duration-200 active:scale-95 ${
                    isTouchInput.current ? 'hover:text-white' : 'hover:text-cyan-400'
                  }`}
                  aria-label={volume === 0 ? "تشغيل الصوت" : "كتم الصوت"}
                >
                  {volume === 0 ? (
                    <Icons.VolumeOff />
                  ) : volume < 0.5 ? (
                    <Icons.VolumeLow />
                  ) : (
                    <Icons.VolumeHigh />
                  )}
                </button>

                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.01"
                  value={volume}
                  onChange={(e) => {
                    const v = parseFloat(e.target.value);
                    if (v > 0) prevVolumeRef.current = v;
                    setVolume(v);
                  }}
                  onPointerDown={showControlsWithOptions}
                  onWheel={handleVolumeWheel}
                  onFocus={() => disablePageScrollWhileInteracting()}
                  onBlur={() => enablePageScrollAfterInteracting()}
                  className={`volume-slider hidden sm:block ml-0.5 xs:ml-0.5 sm:ml-0.5 transition-all duration-300 ease-out ${
                    showVolumeSlider ? 'w-12 sm:w-16 md:w-20 lg:w-28 opacity-100' : 'w-0 opacity-0 sm:w-0'
                  }`}
                  aria-label="مستوى الصوت"
                  onMouseDown={() => disablePageScrollWhileInteracting()}
                  onMouseUp={() => enablePageScrollAfterInteracting()}
                />

                <div className={`text-xs font-bold text-cyan-400 transition-all duration-300 ml-0.5 sm:ml-1 hidden sm:block ${
                  showVolumeSlider ? 'opacity-100 w-auto' : 'opacity-0 w-0 overflow-hidden'
                }`}>
                  {Math.round(volume * 100)}%
                </div>
              </div>

              <div className="relative" ref={qualityRef}>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setQualityMenuOpen(!qualityMenuOpen);
                    setSpeedMenuOpen(false);
                    ignoreDocClickRef.current = true;
                    setTimeout(() => (ignoreDocClickRef.current = false), 50);
                  }}
                  className="quality-btn controls-button flex items-center justify-center gap-0 md:gap-1 rounded-lg sm:rounded-xl bg-gradient-to-br from-gray-900/90 to-black/90 text-white px-2 sm:px-2 md:px-3 py-1.5 sm:py-2 md:py-3 text-xs sm:text-sm shadow-2xl border border-white/10 transition-all duration-300 hover:shadow-cyan-500/25 active:scale-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 backdrop-blur-sm"
                  aria-expanded={qualityMenuOpen}
                  aria-label="اختيار الجودة"
                >
                  <Icons.Quality />
                  <span className="font-bold tracking-wide hidden md:inline">
                    {currentQuality ? `${currentQuality}p` : "الجودة"}
                  </span>
                  <Icons.ChevronDown className="hidden md:inline" />
                </button>
                {qualityMenuOpen && video && video.qualities && (
                  <div className="quality-menu absolute bottom-12 sm:bottom-14 right-0 bg-gradient-to-b from-gray-900 to-black border border-white/20 rounded-lg sm:rounded-2xl shadow-2xl py-1.5 sm:py-2 z-50 w-40 sm:w-56 backdrop-blur-xl max-h-48 sm:max-h-60 overflow-y-auto animate-scale-in">
                    <div className="px-2 sm:px-3 py-1.5 sm:py-2 text-xs text-white/80 font-bold border-b border-white/10">اختر الجودة</div>
                    {[...video.qualities]
                      .sort((a, b) => parseInt(a.quality) - parseInt(b.quality))
                      .map((q) => (
                        <button
                          key={q.quality}
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            handleQualityChangePersist(q.quality);
                          }}
                          onTouchEnd={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            handleQualityChangePersist(q.quality);
                          }}
                          className={`w-full text-right px-2 sm:px-5 py-1.5 sm:py-3 text-xs sm:text-sm transition-all duration-200 ${
                            String(q.quality) === String(currentQuality) 
                              ? "bg-gradient-to-r from-red-600 to-red-800 text-white font-bold" 
                              : "text-white/80 hover:bg-white/10 hover:text-white"
                          }`}
                        >
                          <span className="flex items-center justify-between gap-1">
                            <span className="text-xs opacity-70 hidden sm:inline">{RES_MAP[q.quality] ? `${RES_MAP[q.quality].w}×${RES_MAP[q.quality].h}` : ""}</span>
                            {q.quality}p
                          </span>
                        </button>
                      ))}
                  </div>
                )}
              </div>

              <div className="relative" ref={speedRef}>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setSpeedMenuOpen(!speedMenuOpen);
                    setQualityMenuOpen(false);
                    ignoreDocClickRef.current = true;
                    setTimeout(() => (ignoreDocClickRef.current = false), 50);
                  }}
                  className="speed-btn controls-button flex items-center justify-center gap-0 md:gap-1 rounded-lg sm:rounded-xl bg-gradient-to-br from-gray-900/90 to-black/90 text-white px-2 sm:px-2 md:px-3 py-1.5 sm:py-2 md:py-3 text-xs sm:text-sm shadow-2xl border border-white/10 transition-all duration-300 hover:shadow-cyan-500/25 active:scale-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 backdrop-blur-sm"
                  aria-expanded={speedMenuOpen}
                  aria-label="اختيار السرعة"
                >
                  <Icons.Speed />
                  <span className="font-bold tracking-wide hidden md:inline">{playbackRate.toFixed(2)}x</span>
                  <Icons.ChevronDown className="hidden md:inline" />
                </button>
                {speedMenuOpen && (
                  <div className="speed-menu absolute bottom-12 sm:bottom-14 right-0 bg-gradient-to-b from-gray-900 to-black border border-white/20 rounded-lg sm:rounded-2xl shadow-2xl w-44 sm:w-64 p-2 sm:p-4 backdrop-blur-xl z-50 animate-scale-in">
                    <div className="flex flex-col items-center w-full gap-2 sm:gap-4 mb-1.5 sm:mb-3">
                      <div className="text-xs sm:text-lg font-bold text-white/90 mb-0.5 sm:mb-2">سرعة التشغيل</div>
                      <div className="flex items-center justify-center gap-2 sm:gap-4 w-full">
                        <button
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            adjustRate(-0.05);
                          }}
                          onTouchEnd={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            adjustRate(-0.05);
                          }}
                          className="bg-gradient-to-br from-gray-800 to-black text-white rounded-full w-6 h-6 sm:w-10 sm:h-10 flex items-center justify-center text-sm sm:text-xl shadow-lg transition-all  active:scale-95 border border-white/10"
                        >
                          −
                        </button>
                        <div className="text-lg sm:text-3xl font-bold bg-gradient-to-r from-red-500 to-cyan-500 bg-clip-text text-transparent">
                          {playbackRate.toFixed(2)}x
                        </div>
                        <button
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            adjustRate(0.05);
                          }}
                          onTouchEnd={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            adjustRate(0.05);
                          }}
                          className="bg-gradient-to-br from-gray-800 to-black text-white rounded-full w-6 h-6 sm:w-10 sm:h-10 flex items-center justify-center text-sm sm:text-xl shadow-lg transition-all  active:scale-95 border border-white/10"
                        >
                          +
                        </button>
                      </div>
                      <input
                        type="range"
                        min="0.25"
                        max="3"
                        step="0.05"
                        value={playbackRate}
                        onChange={(e) => {
                          const v = Math.round(parseFloat(e.target.value) * 100) / 100;
                          setPlaybackRate(v);
                          try { showActionFeedbackPos(Icons.Speed, `${v.toFixed(2)}x`, 800, 'top'); } catch (e) { showRateFeedback(v); }
                        }}
                        className="w-full accent-gradient"
                        aria-label="شريط سرعة التشغيل"
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>

            <button
              type="button"
              onClick={toggleFullscreen}
              ref={fsButtonRef}
              className="fullscreen-btn controls-button flex items-center justify-center rounded-lg sm:rounded-xl bg-gradient-to-br from-gray-900/90 to-black/90 text-white px-2 sm:px-3 py-2 sm:py-3 shadow-2xl border border-white/10 transition-all duration-300 hover:shadow-cyan-500/25 active:scale-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 backdrop-blur-sm flex-shrink-0 xs:ml-auto"
              aria-label={isFullscreen ? "خروج من ملء الشاشة" : "ملء الشاشة"}
            >
              {isFullscreen ? <Icons.FullscreenExit /> : <Icons.Fullscreen />}
            </button>
          </div>
        </div>
      </div>
      
      <style>{`
        /* الأنيميشن الأساسية */
        @keyframes fade-in {
          0% { opacity: 0; }
          100% { opacity: 1; }
        }
        
        @keyframes scale-in {
          0% { transform: scale(0.8); opacity: 0; }
          100% { transform: scale(1); opacity: 1; }
        }
        
        @keyframes slide-in-left {
          0% { transform: translateX(-20px) translateY(-50%); opacity: 0; }
          100% { transform: translateX(0) translateY(-50%); opacity: 1; }
        }
        
        @keyframes slide-in-right {
          0% { transform: translateX(20px) translateY(-50%); opacity: 0; }
          100% { transform: translateX(0) translateY(-50%); opacity: 1; }
        }
        
        @keyframes slide-in-top {
          0% { transform: translateX(-50%) translateY(-10px); opacity: 0; }
          100% { transform: translateX(-50%) translateY(0); opacity: 1; }
        }
        
        @keyframes fade-in {
          0% { opacity: 0; }
          100% { opacity: 1; }
        }
        
        .animate-scale-in {
          animation: scale-in 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
        }
        
        .animate-slide-in-left {
          animation: slide-in-left 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
        }
        
        .animate-slide-in-right {
          animation: slide-in-right 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
        }
        
        .animate-slide-in-top {
          animation: slide-in-top 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
        }
        
        .animate-fade-in {
          animation: fade-in 0.3s ease-out;
        }
        
        /* تحسينات شريط التقدم */
        .progress-bar {
          transition: height 0.2s ease;
        }
        
        .progress-bar:hover {
          height: 0.5rem !important;
        }
        
        .progress-bar:hover .progress-handle {
          width: 1rem !important;
          height: 1rem !important;
          box-shadow: 0 0 12px rgba(59, 130, 246, 0.6);
        }
        
        @media (hover: hover) and (pointer: fine) {
          .progress-bar:hover {
            height: 0.375rem;
          }
        }
        
        
        /* تحسينات لشاشات ملء الشاشة */
        .video-player-container.fixed {
          .center-controls {
            gap: 3rem !important;
          }
          
          .center-btn-left,
          .center-btn-right {
            width: 4.5rem !important;
            height: 4.5rem !important;
          }
          
          .center-btn-play {
            width: 6rem !important;
            height: 6rem !important;
          }
          
          .progress-bar {
            height: 0.6rem !important;
          }
          
          .progress-handle {
            width: 1.2rem !important;
            height: 1.2rem !important;
          }
        }
                
        
        /* المنزلقات */
        .accent-gradient {
          background: linear-gradient(to right, #ef4444, #3b82f6);
          height: 0.375rem;
          border-radius: 0.1875rem;
          outline: none;
        }
        
        .accent-gradient::-webkit-slider-thumb {
          appearance: none;
          width: 1.125rem;
          height: 1.125rem;
          border-radius: 50%;
          background: white;
          border: 0.125rem solid #3b82f6;
          cursor: pointer;
          box-shadow: 0 0 0.625rem rgba(59, 130, 246, 0.5);
        }
        
        .accent-gradient::-moz-range-thumb {
          width: 1.125rem;
          height: 1.125rem;
          border-radius: 50%;
          background: white;
          border: 0.125rem solid #3b82f6;
          cursor: pointer;
          box-shadow: 0 0 0.625rem rgba(59, 130, 246, 0.5);
        }
        
        
        
        /* تحسين الوصول */
        .controls-button:focus-visible {
          outline: 2px solid #22d3ee;
          outline-offset: 2px;
          box-shadow: 0 0 0 3px rgba(34, 211, 238, 0.1);
        }
        
        /* دعم السيف أريا */
        .video-player-container:fullscreen {
          padding-top: env(safe-area-inset-top, 0px);
          padding-bottom: env(safe-area-inset-bottom, 0px);
          padding-left: env(safe-area-inset-left, 0px);
          padding-right: env(safe-area-inset-right, 0px);
        }
        
        /* تحسينات الأداء */
        .video-player-container * {
          -webkit-tap-highlight-color: transparent;
          touch-action: manipulation;
        }
        
        /* تصميم منظم للنص */
        .video-title-overlay {
          font-size: clamp(0.75rem, 2.5vw, 1rem);
        }
        
        /* تحسينات للتباعد والمسافات */
        .video-player-wrapper {
          container-type: inline-size;
        }
        
        @container (max-width: 400px) {
          .center-controls {
            gap: 0.5rem !important;
          }
          
          .center-btn-play {
            width: 2.5rem !important;
            height: 2.5rem !important;
          }
        }
      `}</style>
    </div>
  );
}

VideoPlayer.propTypes = {
  video: PropTypes.object,
};

export default React.memo(VideoPlayer);