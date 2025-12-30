import React, {
  useEffect,
  useRef,
  useState,
  useCallback,
} from "react";
import PropTypes from 'prop-types';
import api from "../utils/api";
import { useAuth } from "../hooks/useAuth";

function VideoPlayer({ video = null }) {
  const DEBUG_LONGPRESS = false;
  const dlog = (...args) => {
    try { if (DEBUG_LONGPRESS) console.debug('[VP.longpress]', ...args); } catch (e) {}
  };
  
  // long-press/jitter tuning
  const CONTROLS_REVEAL_SUPPRESS_MS = 1000; // extend suppression after controls reveal
  const JITTER_WINDOW_MS = 500; // window to count rapid pointerdown events
  const JITTER_COUNT_THRESHOLD = 4; // number of pointerdowns in window considered jitter
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
  const hlsRef = useRef(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [bufferedPercent, setBufferedPercent] = useState(0);
  const pointerLongSuppressClickRef = useRef(false);
  const ignoreToggleRef = useRef(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showErrorOverlay, setShowErrorOverlay] = useState(false);
  const errorTimerRef = useRef(null);
  const errorSetDelayRef = useRef(null);
  // collect transient feedback timers so we can clear them on unmount
  const feedbackTimersRef = useRef(new Set());
  const spaceLongPressTimerRef = useRef(null);
  const pointerLongPressTimerRef = useRef(null);
  const [qualityMenuOpen, setQualityMenuOpen] = useState(false);
  const [speedMenuOpen, setSpeedMenuOpen] = useState(false);
  const [settingsMenuOpen, setSettingsMenuOpen] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [fullscreenBottomInset, setFullscreenBottomInset] = useState(0);
  const [currentQuality, setCurrentQuality] = useState(null);
  const [shouldInit, setShouldInit] = useState(true);

  const [volume, setVolume] = useState(() => {
    try {
      const saved = localStorage.getItem("video-volume");
      return saved ? Math.min(1, Math.max(0, parseFloat(saved))) : 0.7;
    } catch (e) {
      return 0.7;
    }
  });

  // refs that must be top-level (do not call hooks inside state initializers)
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
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(null);
  const [hoverProgress, setHoverProgress] = useState(false);

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
  // When toggling menus we briefly ignore the global document click
  // handler to avoid the menu closing immediately after opening.
  const ignoreDocClickRef = useRef(false);
  const [settingsMenuPos, setSettingsMenuPos] = useState(null);

  const { user, isLoggedIn } = useAuth();

  // متغيرات جديدة للتحكم بالتفاعل
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
  
  // توقيتات ثابتة
  const MOBILE_HIDE_TIMEOUT = 3000;
  const DESKTOP_HIDE_TIMEOUT = 2000;
  const MOBILE_TAP_TIMEOUT = 300;
  const LONG_PRESS_THRESHOLD = 500;
  
  // دقة الفيديو المتاحة
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

  // وظائف مساعدة للتحكم في إخفاء عناصر التحكم
  const scheduleHideControls = useCallback((delay) => {
    if (hideControlsTimeoutRef.current) {
      clearTimeout(hideControlsTimeoutRef.current);
    }
    
    // لا نخفي أثناء الضغطة الطويلة أو فتح القوائم
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

  // إظهار التحكم مع الخيارات
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

  // إخفاء التحكم
  const hideControlsSafe = useCallback(() => {
    if (qualityMenuOpen || speedMenuOpen || settingsMenuOpen) return;
    if (longPressState.active || spaceLongActiveRef.current) return;
    
    setShowControls(false);
    setInteractionState(prev => ({
      ...prev,
      controlsVisible: false
    }));
  }, [qualityMenuOpen, speedMenuOpen, settingsMenuOpen, longPressState.active]);

  // عرض ردود الفعل المرئية
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

  // enhanced action feedback that supports positioning: 'center' | 'left' | 'right'
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
        // prevent accidental toggles immediately after long-press
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
      // keep controls visible when adjusting with wheel
      showControlsWithOptions();
    } catch (err) {
      // ignore
    }
  }, [volume, showVolumeFeedback, showControlsWithOptions]);

  // Prevent page scrolling when interacting with the volume control on desktop
  const preventScrollHandler = useCallback((ev) => {
    try { ev.preventDefault(); } catch (e) {}
  }, []);

  const disablePageScrollWhileInteracting = useCallback(() => {
    try {
      if (isTouchInput.current) return; // don't block on touch devices
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

  // keep refs in sync with menu open state so callbacks can read latest values
  useEffect(() => { qualityOpenRef.current = qualityMenuOpen; }, [qualityMenuOpen]);
  useEffect(() => { speedOpenRef.current = speedMenuOpen; }, [speedMenuOpen]);
  useEffect(() => { settingsOpenRef.current = settingsMenuOpen; }, [settingsMenuOpen]);

  // التشغيل الآمن
  const safePlay = useCallback(() => {
    try {
      const v = videoRef.current;
      if (!v) return;
      // Optimistically set playing state so UI responds immediately.
      setIsPlaying(true);
      const playPromise = v.play();
      if (playPromise && typeof playPromise.then === "function") {
        playPromise.then(() => {
          setIsPlaying(true);
          // clear any transient error state when play succeeds
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
          // revert optimistic state on failure
          try { setIsPlaying(false); } catch (e) {}
        });
      }
    } catch (e) {
      console.warn("Safe play error:", e);
    }
  }, []);

  // التبديل بين التشغيل والإيقاف
  const togglePlayPause = useCallback(() => {
    try {
      // ignore toggle when recently triggered by a long-press or when controls were just revealed
      try {
        dlog('togglePlayPause called, ignoreToggle=', ignoreToggleRef.current);
        const now = Date.now();
        if (controlsRevealedAtRef.current && (now - controlsRevealedAtRef.current) < CONTROLS_REVEAL_SUPPRESS_MS) {
          dlog('togglePlayPause suppressed: controls were just revealed', { age: now - controlsRevealedAtRef.current });
          // consume the reveal timestamp to avoid double-suppress
          controlsRevealedAtRef.current = 0;
          return;
        }
        if (ignoreToggleRef.current) {
          // consume the flag and do nothing
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

  // immediate toggle that bypasses the reveal/suppression heuristics
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

  // إعادة المحاولة
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

  // التبديل بين وضع ملء الشاشة والعادي
  const toggleFullscreen = useCallback(() => {
    try {
      if (!videoRef.current) return;
      const container = (containerRef.current && containerRef.current.parentElement) || videoRef.current.parentElement;
      if (!container) return;

      if (!document.fullscreenElement) {
        if (container.requestFullscreen) {
          container.requestFullscreen();
        } else if (container.webkitRequestFullscreen) {
          container.webkitRequestFullscreen();
        } else if (container.msRequestFullscreen) {
          container.msRequestFullscreen();
        }
        setIsFullscreen(true);
      } else {
        if (document.exitFullscreen) {
          document.exitFullscreen();
        } else if (document.webkitExitFullscreen) {
          document.webkitExitFullscreen();
        } else if (document.msExitFullscreen) {
          document.msExitFullscreen();
        }
        setIsFullscreen(false);
      }
    } catch (e) {
      console.warn("Fullscreen toggle error:", e);
    }
  }, []);

  // تحديث أبعاد الفيديو
  const updateVideoSizing = useCallback(() => {
    try {
      const v = videoRef.current;
      if (!v) return;
      if (isFullscreen) {
        // In fullscreen fit by height so the whole video height is visible
        v.style.width = "auto";
        v.style.height = "100%";
        v.style.objectFit = "contain"; // ensure the entire frame is visible
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

  // تحويل الوقت إلى تنسيق مقروء
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

  // التحقق من اتجاه شريط التقدم
  const isProgressRtl = useCallback(() => {
    try {
      const el = progressRef.current;
      if (!el) return document && document.dir === "rtl";
      return getComputedStyle(el).direction === "rtl";
    } catch (e) {
      return document && document.dir === "rtl";
    }
  }, []);

  // التعامل مع البحث في الفيديو
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

  // بدء السحب على شريط التقدم
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

  // حركة السحب على شريط التقدم
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

  // إنهاء السحب على شريط التقدم
  const handlePointerSeekEnd = useCallback(() => {
    progressDragRef.current = false;
    progressDragStartXRef.current = 0;
    progressDragStartTimeRef.current = 0;
    window.removeEventListener("pointermove", handlePointerSeekMove);
    window.removeEventListener("pointerup", handlePointerSeekEnd);
    scheduleHideControls(1000);
  }, [scheduleHideControls]);

  // تطبيق الجودة على HLS
  const applyQualityToHls = useCallback((hls, quality) => {
    if (!hls || !hls.levels || !quality) return;
    const target = RES_MAP[String(quality)];
    // prefer exact height match if possible
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

    // fallback: choose closest height (ignore zero-height variants where possible)
    if (bestIdx < 0) {
      let bestDiff = Infinity;
      for (let i = 0; i < hls.levels.length; i++) {
        const lvl = hls.levels[i];
        const h = lvl?.height || 0;
        // if all levels have height=0, we'll still pick the smallest diff (0)
        const diff = Math.abs((target ? target.h : Number(quality)) - h);
        if (diff < bestDiff) {
          bestDiff = diff;
          bestIdx = i;
        }
      }
    }

    if (bestIdx >= 0) {
      try {
        // disable automatic ABR
        try { hls.autoLevelEnabled = false; } catch (e) {}
        // request the chosen level for the next fragment
        try { hls.nextLevel = bestIdx; } catch (e) {}
        // also set currentLevel to enforce immediate switch
        try { hls.currentLevel = bestIdx; } catch (e) {}
        // re-apply shortly in case hls overwrites during switches
        setTimeout(() => {
          try { hls.currentLevel = bestIdx; } catch (e) {}
        }, 250);
      } catch (e) {
        console.warn('applyQualityToHls error:', e);
      }
    }
  }, []);

  // تغيير جودة الفيديو
  const handleQualityChangePersist = useCallback((q) => {
    try {
      localStorage.setItem(`video-default-quality-${video._id}`, String(q));
    } catch (e) {}
    setCurrentQuality(q);
    setQualityMenuOpen(false);

    // Immediately apply the chosen quality: either instruct Hls.js to switch
    // or replace the native HLS src (browsers like Safari).
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

      // preserve current playback position and play-state
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
          // Force HLS.js to load the playlist for the requested quality
          console.debug && console.debug('HLS: loading playlist for quality', q, playlistUrl);
          try { hlsRef.current.autoLevelEnabled = false; } catch (e) {}
          try { hlsRef.current.loadSource(playlistUrl); } catch (e) {}
          try { hlsRef.current.attachMedia(videoRef.current); } catch (e) {}
          // also attempt explicit level selection as a fallback
          try { applyQualityToHls(hlsRef.current, q); } catch (e) {}
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
  }, [video, applyQualityToHls, safePlay]);

  // التعديل على سرعة التشغيل
  const adjustRate = useCallback((delta) => {
    try {
      const v = Math.round(Math.max(0.25, Math.min(3, playbackRate + delta)) * 100) / 100;
      setPlaybackRate(v);
      // show action feedback (positioned at top half) when rate changed from controls
      try { showActionFeedbackPos(Icons.Speed, `${v.toFixed(2)}x`, 800, 'top'); } catch (e) { showRateFeedback(v); }
      showControlsWithOptions();
    } catch (e) {
      console.warn("Adjust rate error:", e);
    }
  }, [playbackRate, showRateFeedback, showControlsWithOptions]);

  // تحميل الفيديو
  const handleDownload = useCallback(async () => {
    if (isDownloading) return;
    if (!(user?.isAdmin || user?.canDownloadVideos)) {
      setError("فقط المشرفين والمستخدمين المسموح لهم يمكنهم التحميل");
      return;
    }
    if (!currentQuality) {
      setError("اختر جودة أولاً");
      return;
    }

    try {
      const userCode = localStorage.getItem("userCode");
      const downloadUrl = `/api/videos/${video._id}/download?quality=${encodeURIComponent(currentQuality)}${userCode ? `&userCode=${encodeURIComponent(userCode)}` : ""}`;
      
      setIsDownloading(true);
      setDownloadProgress(null);

      const res = await api.get(downloadUrl, {
        responseType: "blob",
        onDownloadProgress: (ev) => {
          try {
            const loaded = ev.loaded || 0;
            const total = ev.total || 0;
            if (total > 0) {
              const pct = Math.round((loaded / total) * 100);
              setDownloadProgress(pct);
            } else {
              setDownloadProgress(null);
            }
          } catch (e) {}
        },
      });

      const blob = new Blob([res.data], {
        type: res.headers["content-type"] || "application/octet-stream",
      });
      const url = window.URL.createObjectURL(blob);
      const cd = res.headers["content-disposition"] || "";
      let filename = `${video && video.title ? video.title.replace(/[^a-z0-9\-_. ]/gi, "_") : "video"}_${currentQuality}p.ts`;
      const m = cd.match(/filename\*=UTF-8''([^;\n\r]+)/);
      if (m && m[1]) filename = decodeURIComponent(m[1]);
      else {
        const m2 = cd.match(/filename="?([^";]+)"?/);
        if (m2 && m[1]) filename = m2[1];
      }

      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
          // allow toggles after a short grace period
          try { setTimeout(() => { ignoreToggleRef.current = false; }, 600); } catch (e) {}
      setTimeout(() => window.URL.revokeObjectURL(url), 10000);

      showActionFeedback(Icons.PlayArrow, "تم التحميل");
    } catch (err) {
      console.error("Download error:", err);
      const msg = err?.response?.data?.message || "فشل التحميل";
      setError(msg);
    } finally {
      setIsDownloading(false);
      setTimeout(() => setDownloadProgress(null), 800);
    }
  }, [video, currentQuality, user, isDownloading, showActionFeedback]);

  // بدء الضغطة الطويلة
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

  // إيقاف الضغطة الطويلة
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

  // تهيئة الفيديو و HLS
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
        // تحميل HLS.js ديناميكياً
        try {
          const mod = await import("hls.js");
          HlsModule = mod && (mod.default || mod);
        } catch (e) {
          HlsModule = null;
          console.warn("HLS.js not available:", e);
        }

        // تحديد جودة الفيديو الافتراضية
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
          // simple retry counter for transient playlist parsing/network errors
          let hlsRetryAttempts = 0;

            hls.on(HlsModule.Events.MANIFEST_PARSED, () => {
              // clear any previous transient error and mark ready
              setError(null);
              setShowErrorOverlay(false);
              setLoading(false);
              if (errorTimerRef.current) {
                try { clearTimeout(errorTimerRef.current); } catch (e) {}
                errorTimerRef.current = null;
              }
              if (errorSetDelayRef.current) {
                try { clearTimeout(errorSetDelayRef.current); } catch (e) {}
                errorSetDelayRef.current = null;
              }
            // Apply saved/default quality once manifest (levels) are available
            try {
              if (defaultQuality) applyQualityToHls(hls, defaultQuality);
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
            // If we received a fatal parsing/network error for the playlist, try one quick retry
            try {
              const details = data && (data.details || data.type || '');
              const isLevelParsing = details && String(details).toLowerCase().includes('levelparsing');
              if (data && data.fatal && isLevelParsing && hlsRetryAttempts < 1) {
                hlsRetryAttempts += 1;
                console.debug && console.debug('HLS: levelParsingError detected — retrying loadSource (attempt)', hlsRetryAttempts);
                setTimeout(() => {
                  try {
                    hls.loadSource(playlistUrl);
                    // restart loading
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
                  msg = "خطأ في الشبكة";
                  break;
                case HlsModule.ErrorTypes.MEDIA_ERROR:
                  msg = "خطأ في الوسائط";
                  break;
                default:
                  msg = "خطأ غير معروف";
                  break;
              }
              // debounce setting the visible error state to avoid brief transient
              if (errorSetDelayRef.current) {
                try { clearTimeout(errorSetDelayRef.current); } catch (e) {}
                errorSetDelayRef.current = null;
              }
              errorSetDelayRef.current = setTimeout(() => {
                setError(msg);
                setLoading(false);
                errorSetDelayRef.current = null;
              }, 700);
            }
          });

          hls.loadSource(playlistUrl);
          hls.attachMedia(videoRef.current);
        } else if (videoRef.current) {
          // Only set src to an m3u8 if the browser supports HLS natively (e.g., Safari).
          // Otherwise avoid assigning the .m3u8 URL directly which may trigger a download in some browsers.
          const v = videoRef.current;
          const canNativeHls = typeof v.canPlayType === "function" && (v.canPlayType('application/vnd.apple.mpegurl') || v.canPlayType('application/x-mpegURL'));
          if (canNativeHls) {
            v.src = playlistUrl;
            v.addEventListener("loadedmetadata", () => {
              // clear transient errors when metadata arrives
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
                setError("فشل التشغيل");
                setLoading(false);
                errorSetDelayRef.current = null;
              }, 700);
            });
          } else {
            setLoading(false);
            setError("متصفحك لا يدعم HLS. الرجاء استخدام متصفح يدعم HLS أو تمكين HLS.js.");
          }
        }

        // تحديث الوقت الحالي
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

        // حلقة تحديث سلسة
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

        // استئناف موضع التشغيل المحفوظ
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

        // حفظ الموضع كل 5 ثوان
        saveInt = setInterval(() => {
          try {
            if (videoRef.current && !isNaN(videoRef.current.currentTime)) {
              localStorage.setItem(
                `video-pos-${video._id}`,
                String(videoRef.current.currentTime),
              );
            }
          } catch (e) {}
        }, 5000);

        // تطبيق مستوى الصوت وسرعة التشغيل
        try {
          if (videoRef.current) {
            videoRef.current.volume = volume;
            videoRef.current.playbackRate = playbackRate;
          }
        } catch (e) {}

        // إخفاء عناصر التحكم بعد 3 ثوان
        scheduleHideControls(3000);
      } catch (err) {
        console.error("Initialization error:", err);
        setError("خطأ في تهيئة المشغل");
        setLoading(false);
      }
    };

    initPlayer();

    // التنظيف
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

  // معالجة أحداث pointer للتفاعلات
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    
    let longPressTimer = null;
    let tapTimer = null;
    
    const handlePointerDown = (e) => {
      pointerTypeRef.current = e.pointerType;
      
      if (e.pointerType === 'touch') {
        // إعداد للجوال
        setInteractionState(prev => ({
          ...prev,
          isTouchInteraction: true,
          isMouseInteraction: false,
          pendingTap: true
        }));
        
        // don't start long-press if the touch began on a control button
        try {
          if (!e.target || !e.target.closest || e.target.closest('.controls-button')) {
            // allow taps on controls to proceed immediately; no long-press timer
            longPressTimer = null;
          } else {
            // بدء مؤقت الضغطة الطويلة
            longPressTimer = setTimeout(() => {
              startLongPress('pointer', { x: e.clientX, y: e.clientY });
            }, LONG_PRESS_THRESHOLD);
          }
        } catch (err) {
          longPressTimer = setTimeout(() => {
            startLongPress('pointer', { x: e.clientX, y: e.clientY });
          }, LONG_PRESS_THRESHOLD);
        }
        
        // مؤقت النقر القصير
        tapTimer = setTimeout(() => {
          setInteractionState(prev => ({
            ...prev,
            pendingTap: false
          }));
        }, MOBILE_TAP_TIMEOUT);
        
      } else if (e.pointerType === 'mouse') {
        // إعداد لسطح المكتب
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
        // حركة الفأرة تظهر التحكم على سطح المكتب
        showControlsWithOptions({ immediate: true });
      }
    };
    
    const handlePointerUp = (e) => {
      // إلغاء المؤقتات
      if (longPressTimer) clearTimeout(longPressTimer);
      if (tapTimer) clearTimeout(tapTimer);
      
      if (longPressState.active) {
        // إيقاف الضغطة الطويلة النشطة
        e.preventDefault();
        e.stopPropagation();
        stopLongPress();
      } else if (e.pointerType === 'touch' && interactionState.pendingTap) {
        // نقر عادي على الجوال
        try {
          // If the tap targeted a control button, allow its click handler to run immediately
          const btn = e.target && e.target.closest && e.target.closest('.controls-button');
          if (btn) {
            // ensure controls visible and don't intercept the click
            setShowControls(true);
            scheduleHideControls(MOBILE_HIDE_TIMEOUT);
            setInteractionState(prev => ({ ...prev, pendingTap: false }));
            return;
          }

          // If controls are hidden and the tap is within the center play area, trigger immediate play
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

          // default: reveal or hide controls (don't block propagation for controls)
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
        // على سطح المكتب لا نبدّل التشغيل عند النقر في منطقة فارغة
        // تفاعل أزرار التشغيل يتم عبر أزرار بعلامة `controls-button` وتستجيب فورًا
      }
      
      setInteractionState(prev => ({
        ...prev,
        pendingTap: false
      }));
    };
    
    const handleDoubleClick = (e) => {
      if (pointerTypeRef.current === 'mouse') {
        // ignore double-clicks that target controls
        if (e.target && e.target.closest && e.target.closest('.controls-button')) return;
        // otherwise only toggle fullscreen when dblclicking the video/container area
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
  
  // إدارة الضغطة الطويلة بمسطرة المسافة
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.code === 'Space') {
        e.preventDefault();
        
        if (isTouchInput.current) return;
        
        if (e.repeat) {
          // الضغطة الطويلة على سطح المكتب
          if (!spaceLongActiveRef.current) {
            spaceLongActiveRef.current = true;
            startDoubleSpeed();
            showControlsWithOptions({ immediate: true, extendTimeout: false });
          }
        } else {
          // النقر القصير
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

  // التحكم في إظهار/إخفاء عناصر التحكم
  useEffect(() => {
    if (showControls) {
      scheduleHideControls();
    } else {
      clearHideControls();
    }
    return () => clearHideControls();
  }, [showControls, qualityMenuOpen, speedMenuOpen, settingsMenuOpen, scheduleHideControls, clearHideControls]);

  // Delay showing error overlay — only show if still not playing after debounce
  useEffect(() => {
    if (error) {
      // reset overlay visibility then show after longer delay only if not playing
      setShowErrorOverlay(false);
      if (errorTimerRef.current) clearTimeout(errorTimerRef.current);
      errorTimerRef.current = setTimeout(() => {
        try {
          if (!isPlaying && error) setShowErrorOverlay(true);
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

  // clear any pending debounced error timer on unmount
  useEffect(() => {
    return () => {
      if (errorSetDelayRef.current) {
        try { clearTimeout(errorSetDelayRef.current); } catch (e) {}
        errorSetDelayRef.current = null;
      }
    };
  }, []);

  // compute an estimated bottom inset for fullscreen on mobile
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

        // ensure the fullscreen container fills the visible viewport height
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
      // cleanup container styles on exit
      try {
        const container = containerRef.current;
        if (container) {
          container.style.removeProperty('height');
          container.style.removeProperty('max-height');
        }
      } catch (e) {}
    };
  }, [isFullscreen]);

  // مزامنة مستوى الصوت
  useEffect(() => {
    try {
      if (videoRef.current) videoRef.current.volume = volume;
      localStorage.setItem("video-volume", String(volume));
      if (volume > 0) prevVolumeRef.current = volume;
    } catch (e) {
      console.warn("Volume sync error:", e);
    }
  }, [volume]);

  // مزامنة سرعة التشغيل
  useEffect(() => {
    try {
      if (videoRef.current) videoRef.current.playbackRate = playbackRate;
      localStorage.setItem("video-rate", String(playbackRate));
    } catch (e) {
      console.warn("Playback rate sync error:", e);
    }
  }, [playbackRate]);

  // معالجة اختصارات لوحة المفاتيح الإضافية
  useEffect(() => {
    const onKey = (e) => {
      if (!videoRef.current) return;
      const v = videoRef.current;
      
      // معالجة مسطرة المسافة تمت في useEffect منفصل
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
    
    // استجابة لتغيير وضع ملء الشاشة
    const handleFullscreenChange = () => {
      const isFs = !!document.fullscreenElement;
      setIsFullscreen(isFs);
      setShowControls(true);
      clearHideControls();
      if (!isFs) {
        setTimeout(updateVideoSizing, 100);
        scheduleHideControls(3000);
      }
    };
    document.addEventListener("fullscreenchange", handleFullscreenChange);

    // Media Session API
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

  // cleanup any transient feedback timers on unmount
  useEffect(() => {
    return () => {
      try {
        feedbackTimersRef.current.forEach((t) => clearTimeout(t));
        feedbackTimersRef.current.clear();
      } catch (e) {}
    };
  }, []);

  // keep controls visible while a long-press is active
  useEffect(() => {
    try {
      if (isLongPressActive || longPressState.active || spaceLongActiveRef.current) {
        setShowControls(true);
        clearHideControls();
      }
    } catch (e) {}
  }, [isLongPressActive, longPressState.active, clearHideControls]);

  // مزامنة حالة التشغيل
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

  // إغلاق القوائم عند النقر خارجها
  useEffect(() => {
    const onDocClick = (e) => {
      if (ignoreDocClickRef.current) return;
      if (qualityMenuOpen && qualityRef.current && !qualityRef.current.contains(e.target)) {
        setQualityMenuOpen(false);
      }
      if (speedMenuOpen && speedRef.current && !speedRef.current.contains(e.target)) {
        setSpeedMenuOpen(false);
      }
      if (settingsMenuOpen && settingsRef.current && !settingsRef.current.contains(e.target)) {
        setSettingsMenuOpen(false);
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
  }, [qualityMenuOpen, speedMenuOpen, settingsMenuOpen]);

  // Close the small fixed settings menu on scroll/resize to avoid misplaced popovers
  useEffect(() => {
    if (!settingsMenuOpen) return;
    const onClose = () => {
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

  // تحديث أبعاد الفيديو عند تغيير الجودة أو وضع ملء الشاشة
  useEffect(() => {
    updateVideoSizing();
    if (hlsRef.current && currentQuality) {
      applyQualityToHls(hlsRef.current, currentQuality);
    }
  }, [currentQuality, isFullscreen, updateVideoSizing, applyQualityToHls]);

  // تحديث أبعاد الفيديو عند تغيير حجم النافذة
  useEffect(() => {
    const handleResize = () => {
      updateVideoSizing();
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [updateVideoSizing]);

  // أيقونات SVG
  const Icons = {
    Play: () => (
      <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
        <path d="M8 5V19L19 12L8 5Z" />
      </svg>
    ),
    Replay10: () => (
      <svg className="w-5 h-5 sm:w-6 sm:h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
        <circle cx="12" cy="12" r="9" strokeWidth="1.4" fill="none" />
        <path d="M8.5 9.5L5.5 12L8.5 14.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
        <path d="M9.5 7.5A6 6 0 0 1 17 12" strokeLinecap="round" fill="none" strokeWidth="1.4" />
      </svg>
    ),
    Pause: () => (
      <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
        <rect x="6" y="5" width="4" height="14" />
        <rect x="14" y="5" width="4" height="14" />
      </svg>
    ),
    Forward10: () => (
      <svg className="w-5 h-5 sm:w-6 sm:h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
        <circle cx="12" cy="12" r="9" strokeWidth="1.4" fill="none" />
        <path d="M15.5 9.5L18.5 12L15.5 14.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
        <path d="M14.5 7.5A6 6 0 0 0 7 12" strokeLinecap="round" fill="none" strokeWidth="1.4" />
      </svg>
    ),
    Settings: () => (
      <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 15.5C13.93 15.5 15.5 13.93 15.5 12C15.5 10.07 13.93 8.5 12 8.5C10.07 8.5 8.5 10.07 8.5 12C8.5 13.93 10.07 15.5 12 15.5Z" />
        <path d="M19.43 12.97C19.47 12.65 19.5 12.33 19.5 12C19.5 11.67 19.47 11.34 19.43 11.01L21.54 9.37C21.73 9.22 21.78 8.95 21.66 8.73L19.66 5.27C19.54 5.05 19.27 4.96 19.05 5.05L16.56 6.05C16.04 5.66 15.5 5.32 14.87 5.07L14.5 2.42C14.46 2.18 14.25 2 14 2H10C9.75 2 9.54 2.18 9.5 2.42L9.13 5.07C8.5 5.32 7.96 5.66 7.44 6.05L4.95 5.05C4.73 4.96 4.46 5.05 4.34 5.27L2.34 8.73C2.22 8.95 2.27 9.22 2.46 9.37L4.57 11.01C4.53 11.34 4.5 11.67 4.5 12C4.5 12.33 4.53 12.65 4.57 12.97L2.46 14.63C2.27 14.78 2.22 15.05 2.34 15.27L4.34 18.73C4.46 18.95 4.73 19.03 4.95 18.95L7.44 17.94C7.96 18.34 8.5 18.68 9.13 18.93L9.5 21.58C9.54 21.82 9.75 22 10 22H14C14.25 22 14.46 21.82 14.5 21.58L14.87 18.93C15.5 18.68 16.04 18.34 16.56 17.94L19.05 18.95C19.27 19.03 19.54 18.95 19.66 18.73L21.66 15.27C21.78 15.05 21.73 14.78 21.54 14.63L19.43 12.97Z" />
      </svg>
    ),
    VolumeOff: () => (
      <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
        <path d="M16.5 12C16.5 10.23 15.48 8.71 14 7.97V10.18L16.45 12.63C16.48 12.43 16.5 12.22 16.5 12Z" />
        <path d="M19 12C19 12.94 18.8 13.82 18.46 14.64L19.97 16.15C20.62 14.91 21 13.5 21 12C21 7.72 18.01 4.14 14 3.23V5.29C16.89 6.15 19 8.83 19 12Z" />
        <path d="M4.27 3L3 4.27L7.73 9H3V15H7L12 20V13.27L16.25 17.52C15.58 18.04 14.83 18.46 14 18.7V20.77C15.38 20.45 16.63 19.82 17.68 18.93L19.73 21L21 19.73L12 10.73L4.27 3Z" />
      </svg>
    ),
    VolumeLow: () => (
      <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
        <path d="M7 9V15H11L16 20V4L11 9H7Z" />
      </svg>
    ),
    VolumeHigh: () => (
      <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
        <path d="M3 9V15H7L12 20V4L7 9H3Z" />
        <path d="M16.5 12C16.5 10.23 15.48 8.71 14 7.97V16.02C15.48 15.29 16.5 13.77 16.5 12Z" />
        <path d="M14 3.23V5.29C16.89 6.15 19 8.83 19 12C19 15.17 16.89 17.85 14 18.71V20.77C18.01 19.86 21 16.28 21 12C21 7.72 18.01 4.14 14 3.23Z" />
      </svg>
    ),
    Fullscreen: () => (
      <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
        <path d="M7 14H5V19H10V17H7V14Z" />
        <path d="M5 10H7V7H10V5H5V10Z" />
        <path d="M17 17H14V19H19V14H17V17Z" />
        <path d="M14 5V7H17V10H19V5H14Z" />
      </svg>
    ),
    FullscreenExit: () => (
      <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
        <path d="M5 16H8V19H10V14H5V16Z" />
        <path d="M8 8H5V10H10V5H8V8Z" />
        <path d="M14 19H16V16H19V14H14V19Z" />
        <path d="M16 8V5H14V10H19V8H16Z" />
      </svg>
    ),
    Quality: () => (
      <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
        <path d="M19 4H5C3.89 4 3 4.9 3 6V18C3 19.1 3.89 20 5 20H19C20.1 20 21 19.1 21 18V6C21 4.9 20.11 4 19 4ZM19 18H5V6H19V18Z" />
        <path d="M7.5 13.5H9.5V15H7.5V13.5Z" />
        <path d="M11.5 13.5H13.5V15H11.5V13.5Z" />
        <path d="M15.5 13.5H17.5V15H15.5V13.5Z" />
      </svg>
    ),
    Speed: () => (
      <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
        <path d="M20.38 8.57L13.92 2.2C13.72 2.07 13.56 2 13.3 2H6.5C5.67 2 5 2.67 5 3.5V20.5C5 21.33 5.67 22 6.5 22H17.5C18.33 22 19 21.33 19 20.5V9.3C19 9.04 18.93 8.78 18.7 8.58L20.38 8.57Z" />
        <path d="M12 17.5C10.07 17.5 8.5 15.93 8.5 14C8.5 12.07 10.07 10.5 12 10.5C13.93 10.5 15.5 12.07 15.5 14C15.5 15.93 13.93 17.5 12 17.5Z" />
      </svg>
    ),
    ChevronDown: () => (
      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
        <path d="M7.41 8.59L12 13.17L16.59 8.59L18 10L12 16L6 10L7.41 8.59Z" />
      </svg>
    ),
    PlayArrow: () => (
      <svg className="w-8 h-8 sm:w-10 sm:h-10" viewBox="0 0 24 24" fill="currentColor">
        <path d="M8 5V19L19 12L8 5Z" />
      </svg>
    ),
    PauseCircle: () => (
      <svg className="w-8 h-8 sm:w-10 sm:h-10" viewBox="0 0 24 24" fill="currentColor">
        <path d="M9 16H11V8H9V16ZM13 8V16H15V8H13ZM12 2C6.48 2 2 6.48 2 12C2 17.52 6.48 22 12 22C17.52 22 22 17.52 22 12C22 6.48 17.52 2 12 2ZM12 20C7.59 20 4 16.41 4 12C4 7.59 7.59 4 12 4C16.41 4 20 7.59 20 12C20 16.41 16.41 20 12 20Z" />
      </svg>
    ),
  };

  const progressPct = duration ? (currentTime / duration) * 100 : 0;

  return (
    <div className="space-y-2 relative">
      <div
        className={`relative w-full bg-gradient-to-br from-gray-900 to-black rounded-xl 
          ${isFullscreen ? "fixed inset-0 z-50 rounded-none overflow-visible" : "aspect-video max-h-[70vh] shadow-lg overflow-hidden"} ${showControls ? "" : "cursor-none"}`}
        ref={containerRef}
        style={isFullscreen ? { paddingBottom: `calc(env(safe-area-inset-bottom, 0px) + 1.5rem + ${fullscreenBottomInset}px)` } : undefined}
        onClick={(e) => {
          try {
            const cx = e.clientX;
            const cy = e.clientY;

            // If controls are hidden, allow clicking the area where the center play or fullscreen buttons appear
            if (!showControls) {
              // center-area detection: expand hitbox slightly for easier tapping on mobile
              if (centerPlayRef.current) {
                const r = centerPlayRef.current.getBoundingClientRect();
                const PAD = Math.min(40, Math.max(12, Math.round(Math.min(r.width, r.height) * 0.25)));
                const left = r.left - PAD;
                const right = r.right + PAD;
                const top = r.top - PAD;
                const bottom = r.bottom + PAD;
                if (cx >= left && cx <= right && cy >= top && cy <= bottom) {
                  // immediate play on center tap (bypass suppression heuristics)
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

              // other empty-area taps should NOT toggle playback — just reveal controls
              setShowControls(true);
              scheduleHideControls(3000);
              return;
            }

            // ignore clicks that immediately follow a pointer long-press (but only after center logic above)
            if (pointerLongSuppressClickRef.current) {
              try { pointerLongSuppressClickRef.current = false; } catch (e) {}
              return;
            }

            // otherwise toggle controls if clicking on the video element
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
          onWaiting={() => setLoading(true)}
          onCanPlay={() => setLoading(false)}
          onCanPlayThrough={() => setLoading(false)}
          onLoadedMetadata={(e) => {
            try {
              const d = e?.target?.duration;
              if ((!duration || duration === 0) && d && d > 0) setDuration(d);
              setLoading(false);
            } catch (err) {}
          }}
        ></video>

        {/* overlay that intercepts clicks during pending/active long-press */}
        {(isPendingLongPress || isLongPressActive) && (
          <div className="absolute inset-0 z-[100000]" style={{ pointerEvents: 'auto' }} />
        )}

        {/* مؤشر التحميل */}
        {loading && (
          <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/50">
            <div className="flex flex-col items-center gap-2">
              <svg className="w-12 h-12 text-white animate-spin" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
              </svg>
              <div className="text-white/90 text-sm">جارٍ التحميل...</div>
            </div>
          </div>
        )}

        {/* ردود الفعل المرئية */}
        {actionFeedback.visible && actionFeedback.position === 'center' && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-40">
            <div className="flex flex-col items-center gap-2 bg-black/40 text-white/95 px-4 py-3 rounded-xl backdrop-blur-sm">
              <div className="text-3xl">{actionFeedback.icon ? actionFeedback.icon() : null}</div>
              <div className="text-sm font-medium">{actionFeedback.text}</div>
            </div>
          </div>
        )}

        {actionFeedback.visible && actionFeedback.position === 'top' && (
          <div className="absolute left-1/2 transform -translate-x-1/2 pointer-events-none z-50" style={{ top: '25%' }}>
            <div className="flex flex-col items-center gap-2 bg-black/40 text-white/95 px-3 py-2 rounded-xl backdrop-blur-sm">
              <div className="text-2xl">{actionFeedback.icon ? actionFeedback.icon() : null}</div>
              <div className="text-sm font-medium">{actionFeedback.text}</div>
            </div>
          </div>
        )}

        {actionFeedback.visible && actionFeedback.position === 'left' && (
          <div className="absolute top-1/2 left-6 transform -translate-y-1/2 pointer-events-none z-40">
            <div className="flex flex-col items-center gap-2 bg-black/40 text-white/95 px-3 py-2 rounded-xl backdrop-blur-sm">
              <div className="text-2xl">{actionFeedback.icon ? actionFeedback.icon() : null}</div>
              <div className="text-sm font-medium">{actionFeedback.text}</div>
            </div>
          </div>
        )}

        {actionFeedback.visible && actionFeedback.position === 'right' && (
          <div className="absolute top-1/2 right-6 transform -translate-y-1/2 pointer-events-none z-40">
            <div className="flex flex-col items-center gap-2 bg-black/40 text-white/95 px-3 py-2 rounded-xl backdrop-blur-sm">
              <div className="text-2xl">{actionFeedback.icon ? actionFeedback.icon() : null}</div>
              <div className="text-sm font-medium">{actionFeedback.text}</div>
            </div>
          </div>
        )}

        {seekFeedback.visible && !actionFeedback.visible && (
          <div className={`absolute top-1/2 transform -translate-y-1/2 ${seekFeedback.type === "forward" ? "right-6" : "left-6"} pointer-events-none z-40`}>
            <div className="flex flex-col items-center gap-2 bg-black/40 text-white/95 px-3 py-2 rounded-xl backdrop-blur-sm">
              <div className="text-2xl">
                {seekFeedback.type === "forward" ? <Icons.Forward10 /> : <Icons.Replay10 />}
              </div>
              <div className="text-sm font-medium">{seekFeedback.time}</div>
            </div>
          </div>
        )}

        {rateFeedback.visible && !actionFeedback.visible && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-40">
            <div className="flex flex-col items-center gap-2 bg-black/40 text-white/95 px-4 py-3 rounded-xl backdrop-blur-sm">
              <div className="text-2xl font-semibold">{rateFeedback.rate}x</div>
            </div>
          </div>
        )}

        {volumeFeedback.visible && !actionFeedback.visible && (
          <div className="absolute left-1/2 transform -translate-x-1/2 z-40 pointer-events-none" style={{ top: '6%' }}>
            <div className="flex flex-col items-center gap-1 bg-black/40 text-white/95 px-3 py-2 rounded-xl backdrop-blur-sm">
              <div className="text-sm">مستوى الصوت</div>
              <div className="text-lg font-semibold">{volumeFeedback.volume}%</div>
            </div>
          </div>
        )}

        {/* تقدم التحميل */}
        {isDownloading && downloadProgress != null && (
          <div
            className="absolute left-1/2 -translate-x-1/2 bottom-4 z-40 pointer-events-none w-2/5"
            style={isFullscreen ? { bottom: `calc(1rem + env(safe-area-inset-bottom) + ${fullscreenBottomInset}px)` } : undefined}
          >
            <div className="w-full h-2 bg-white/20 rounded-full overflow-hidden shadow-inner">
              <div
                className="h-full bg-cyan-500 transition-all"
                style={{ width: `${downloadProgress}%` }}
              />
            </div>
          </div>
        )}

        {/* رسالة الخطأ */}
        {error && showErrorOverlay && (
          <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-black/90 to-gray-900/90 backdrop-blur-md">
            <div className="text-center p-8 bg-gradient-to-br from-gray-900 to-black rounded-2xl max-w-sm border border-white/10 shadow-2xl">
              <div className="text-red-400 text-xl mb-4 font-semibold flex items-center justify-center gap-2">
                <span className="text-2xl">⚠️</span> {error}
              </div>
              <button
                onClick={retryPlayback}
                className="px-6 py-3 bg-gradient-to-r from-red-600 to-red-700 text-white rounded-xl transition duration-150 shadow-lg  font-medium"
              >
                إعادة المحاولة
              </button>
            </div>
          </div>
        )}

        {/* عناصر التحكم المركزية */}
        {showControls && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-[99999]">
            <div className="flex items-center gap-3 sm:gap-4 md:gap-6 pointer-events-auto">
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
                className="controls-button flex items-center justify-center w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-black/60 text-white shadow-lg transition-transform "
              >
                <Icons.Replay10 />
              </button>

              <button
                type="button"
                aria-label={isPlaying ? "إيقاف" : "تشغيل"}
                onClick={togglePlayPauseImmediate}
                ref={centerPlayRef}
                className="controls-button flex items-center justify-center w-16 h-16 md:w-20 md:h-20 rounded-full bg-gradient-to-br from-red-600 to-red-700 text-white shadow-2xl transition-transform  z-[99999]"
              >
                {isPlaying ? <Icons.PauseCircle /> : <Icons.PlayArrow />}
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
                className="controls-button flex items-center justify-center w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-black/60 text-white shadow-lg transition-transform  z-[99999]"
              >
                <Icons.Forward10 />
              </button>
            </div>
          </div>
        )}

        {/* شريط التقدم */}
        <div
          className={`absolute left-0 right-0 bottom-16 px-2 transition-opacity duration-200 z-50 bg-black/20 backdrop-blur-sm rounded-md ${showControls ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"}`}
          style={isFullscreen ? { bottom: `calc(4rem + env(safe-area-inset-bottom) + ${fullscreenBottomInset}px)` } : undefined}
        >
          <div className="flex items-center gap-3">
            <div className="text-white/90 font-medium text-sm">
              <span className="bg-black/30 px-2 py-1 rounded-md">
                {formatTime(currentTime)}
              </span>
              <span className="text-white/70 ml-2">/ {formatTime(duration)}</span>
            </div>

            <div className="flex-1">
              <div
                role="slider"
                aria-label="شريط التقدم"
                aria-valuemin={0}
                aria-valuemax={duration || 0}
                aria-valuenow={currentTime}
                tabIndex={0}
                ref={progressRef}
                className={`relative cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 h-3 sm:h-2 bg-gradient-to-r from-gray-800/60 to-gray-800/30 rounded-full shadow-inner`}
                onClick={handleSeek}
                onMouseDown={handlePointerSeekStart}
                onMouseEnter={() => setHoverProgress(true)}
                onMouseLeave={() => setHoverProgress(false)}
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
                  className="absolute top-0 h-full bg-gradient-to-r from-gray-400/40 to-gray-300/40 rounded-full"
                  style={{
                    [isProgressRtl() ? "right" : "left"]: 0,
                    width: `${bufferedPercent || 0}%`,
                    zIndex: 0,
                  }}
                />

                <div
                  className={`absolute top-0 h-full rounded-full shadow-lg ${hoverProgress ? "bg-gradient-to-r from-cyan-400 via-cyan-500 to-cyan-600" : "bg-gradient-to-r from-red-500 via-red-600 to-red-700"}`}
                  style={{
                    [isProgressRtl() ? "right" : "left"]: 0,
                    width: `${progressPct}%`,
                    zIndex: 1,
                  }}
                />

                <div
                  className={`absolute top-1/2 -translate-y-1/2 cursor-pointer transition duration-150 rounded-full bg-white border-2 ${hoverProgress ? "border-cyan-400" : "border-red-600"} shadow-xl`}
                  style={{
                    [isProgressRtl() ? "right" : "left"]: `${progressPct}%`,
                    transform: isProgressRtl() ? "translate(50%, -50%)" : "translate(-50%, -50%)",
                    zIndex: 2,
                    width: "0.9rem",
                    height: "0.9rem",
                  }}
                  aria-hidden
                />
              </div>
            </div>
          </div>
        </div>

        {/* زر ملء الشاشة */}
        <div
          className={`absolute left-4 bottom-6 z-[9999999] transition-opacity duration-200 ${showControls ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"}`}
          style={isFullscreen ? { bottom: `calc(1.5rem + env(safe-area-inset-bottom) + ${fullscreenBottomInset}px)` } : undefined}
        >
          <button
            type="button"
            onClick={toggleFullscreen}
            ref={fsButtonRef}
            className="flex items-center justify-center rounded-full bg-gradient-to-br from-gray-900/80 to-black/80 text-white min-w-[36px] h-8 sm:min-w-[44px] sm:h-11 sm:w-10 shadow-lg transition-transform  focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 hover:bg-white/10 p-1"
            aria-label={isFullscreen ? "خروج من ملء الشاشة" : "ملء الشاشة"}
          >
            {isFullscreen ? <Icons.FullscreenExit /> : <Icons.Fullscreen />}
          </button>
        </div>

        {/* عناصر التحكم السفلية */}
        <div
          className={`absolute left-0 right-0 bottom-4 px-2 transition-opacity duration-200 z-[99999] bg-black/20 backdrop-blur-sm rounded-md ${showControls ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"}`}
        >
          <div className="flex flex-row items-center justify-between gap-2 sm:gap-3">
            <div className="flex items-center gap-2 sm:gap-3 flex-wrap w-full sm:w-auto justify-start">
              <button
                onClick={togglePlayPauseImmediate}
                className="controls-button flex items-center justify-center rounded-full bg-gradient-to-br from-gray-900 to-black min-w-[44px] h-9 sm:min-w-[56px] sm:h-12 sm:w-14 text-white shadow-2xl  transition-transform  focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400"
                aria-label={isPlaying ? "إيقاف" : "تشغيل"}
              >
                {isPlaying ? <Icons.Pause /> : <Icons.Play />}
              </button>

              <button
                onClick={() => {
                  if (volume > 0) {
                    prevVolumeRef.current = volume;
                    setVolume(0);
                  } else {
                    setVolume(prevVolumeRef.current > 0 ? prevVolumeRef.current : 1);
                  }
                }}
                className="controls-button flex items-center justify-center rounded-full bg-gradient-to-br from-gray-900/80 to-black/80 min-w-[36px] h-8 sm:min-w-[44px] sm:h-11 sm:w-10 text-white shadow  transition-transform  focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400"
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
                onMouseEnter={() => disablePageScrollWhileInteracting()}
                onMouseLeave={() => enablePageScrollAfterInteracting()}
                onFocus={() => disablePageScrollWhileInteracting()}
                onBlur={() => enablePageScrollAfterInteracting()}
                className="hidden sm:block w-16 sm:w-28 ml-2 accent-red-600"
                aria-label="مستوى الصوت"
              />

              {/* قائمة الجودة (لشاشات كبيرة) */}
              <div className="relative hidden sm:block" ref={qualityRef}>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setQualityMenuOpen(!qualityMenuOpen);
                    setSpeedMenuOpen(false);
                    setSettingsMenuOpen(false);
                    ignoreDocClickRef.current = true;
                    setTimeout(() => (ignoreDocClickRef.current = false), 50);
                  }}
                  className="controls-button flex items-center gap-2 rounded-xl bg-gradient-to-br from-gray-900/90 to-black/90 text-white px-2 py-1 shadow-lg border border-white/10 min-w-[36px] h-8 sm:min-w-[44px] sm:h-10 transition-transform  focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400"
                  aria-expanded={qualityMenuOpen}
                  aria-label="اختيار الجودة"
                >
                  <Icons.Quality />
                  <span className="font-medium">
                    {currentQuality ? `${currentQuality}p` : "الجودة"}
                  </span>
                  <Icons.ChevronDown />
                </button>
                {qualityMenuOpen && video && video.qualities && (
                  <div className="absolute bottom-12 right-0 bg-gradient-to-b from-gray-900 to-black border border-white/10 rounded-xl shadow-2xl py-2 z-50 w-52 backdrop-blur-lg max-h-60 overflow-y-auto">
                    {[...video.qualities]
                      .sort((a, b) => parseInt(a.quality) - parseInt(b.quality))
                      .map((q) => (
                        <button
                          key={q.quality}
                          onClick={() => handleQualityChangePersist(q.quality)}
                          className={`w-full text-right px-5 py-3 text-sm ${String(q.quality) === String(currentQuality) ? "bg-gradient-to-r from-red-600 to-red-800 text-white font-semibold" : "text-white/80"}`}
                        >
                          <span>{q.quality}p</span>
                        </button>
                      ))}
                  </div>
                )}
              </div>

              {/* قائمة السرعة (لشاشات كبيرة) */}
              <div className="relative hidden sm:block" ref={speedRef}>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setSpeedMenuOpen(!speedMenuOpen);
                    setQualityMenuOpen(false);
                    setSettingsMenuOpen(false);
                    ignoreDocClickRef.current = true;
                    setTimeout(() => (ignoreDocClickRef.current = false), 50);
                  }}
                  className="controls-button flex items-center gap-2 rounded-xl bg-gradient-to-br from-gray-900/90 to-black/90 text-white px-2 py-1 shadow-lg border border-white/10 min-w-[36px] h-8 sm:min-w-[44px] sm:h-10 transition-transform focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400"
                  aria-expanded={speedMenuOpen}
                  aria-label="اختيار السرعة"
                >
                  <Icons.Speed />
                  <span className="font-medium">{playbackRate.toFixed(2)}x</span>
                  <Icons.ChevronDown />
                </button>
                {speedMenuOpen && (
                  <div className="absolute bottom-12 right-0 bg-gradient-to-b from-gray-900 to-black border border-white/10 rounded-2xl shadow-2xl w-56 p-3 backdrop-blur-lg z-50">
                    <div className="flex flex-col items-center w-full gap-3 mb-3">
                      <div className="flex items-center justify-center gap-3 w-full">
                        <button
                          onClick={() => adjustRate(-0.05)}
                          className="bg-black/60 text-white rounded-full w-8 h-8 flex items-center justify-center text-lg"
                        >
                          −
                        </button>
                        <div className="text-2xl font-semibold text-white">
                          {playbackRate.toFixed(2)}x
                        </div>
                        <button
                          onClick={() => adjustRate(0.05)}
                          className="bg-black/60 text-white rounded-full w-8 h-8 flex items-center justify-center text-lg"
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
                        className="w-full accent-red-600"
                        aria-label="شريط سرعة التشغيل"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* قائمة الإعدادات (لشاشات صغيرة) */}
              <div className="relative sm:hidden" ref={settingsRef}>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    const willOpen = !settingsMenuOpen;
                    setQualityMenuOpen(false);
                    setSpeedMenuOpen(false);
                    ignoreDocClickRef.current = true;
                    setTimeout(() => (ignoreDocClickRef.current = false), 50);
                    // compute position anchored to the settings button
                    try {
                      const rect = settingsRef.current && settingsRef.current.getBoundingClientRect();
                      // menu width/height estimates for placement logic
                      const MENU_W = 140; // approx px (w-36)
                      const MENU_H = 160; // estimated height in px
                      if (rect) {
                        const winW = window.innerWidth || 0;
                        const winH = window.innerHeight || 0;
                        const left = Math.max(8, Math.min(rect.left, winW - MENU_W - 8));

                        // compute available space below and above the button
                        const bottomInset = isFullscreen ? (fullscreenBottomInset || 0) : 0;
                        const availableBelow = winH - rect.bottom - bottomInset;
                        const availableAbove = rect.top;

                        let top;
                        if (availableBelow >= MENU_H + 12) {
                          // enough room below
                          top = rect.bottom + 6;
                        } else if (availableAbove >= MENU_H + 12) {
                          // show above the button
                          top = Math.max(8, rect.top - MENU_H - 6);
                        } else {
                          // fallback: clamp to within viewport
                          top = Math.max(8, Math.min(rect.bottom + 6, winH - MENU_H - 8));
                        }

                        setSettingsMenuPos({ left, top });
                      } else {
                        setSettingsMenuPos(null);
                      }
                    } catch (err) {
                      setSettingsMenuPos(null);
                    }
                    setSettingsMenuOpen(willOpen);
                    if (!willOpen) setSettingsMenuPos(null);
                  }}
                  className="controls-button flex items-center justify-center rounded-xl bg-gradient-to-br from-gray-900/90 to-black/90 text-white px-2 py-1 shadow-lg border border-white/10 min-w-[36px] h-8 transition-transform  focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400"
                  aria-label="الإعدادات"
                >
                  <Icons.Settings />
                </button>
                {settingsMenuOpen && (
                  <div
                    className="fixed bg-gradient-to-b from-gray-900 to-black border border-white/10 rounded-md shadow-2xl z-[99999] w-36 max-h-64 overflow-y-auto backdrop-blur-lg p-2"
                    style={settingsMenuPos ? { left: `${settingsMenuPos.left}px`, top: `${settingsMenuPos.top}px` } : { right: '0.75rem', bottom: '5rem' }}
                  >
                    <div className="px-2 pt-1 text-xs text-white/80 font-medium">الجودة</div>
                    {video &&
                      video.qualities &&
                      [...video.qualities]
                        .sort((a, b) => parseInt(a.quality) - parseInt(b.quality))
                        .map((q) => (
                          <button
                            key={q.quality}
                            onClick={() => handleQualityChangePersist(q.quality)}
                            className={`w-full text-right px-2 py-1 text-xs rounded ${String(q.quality) === String(currentQuality) ? "bg-gradient-to-r from-red-600 to-red-800 text-white font-semibold" : "text-white/80 hover:bg-white/5"}`}
                          >
                            {q.quality}p
                          </button>
                        ))}
                    <div className="px-2 pt-2 text-xs text-white/80 flex items-center justify-between">
                      <div className="text-xs">السرعة</div>
                      <div className="font-semibold text-white text-xs">{playbackRate.toFixed(2)}x</div>
                    </div>
                    <div className="px-2 pb-2 pt-2">
                      <input
                        type="range"
                        min="0.25"
                        max="3"
                        step="0.05"
                        value={playbackRate}
                        onChange={(e) => {
                          const v = Math.round(parseFloat(e.target.value) * 100) / 100;
                          setPlaybackRate(v);
                          showRateFeedback(v);
                        }}
                        className="w-full accent-red-600"
                      />
                    </div>
                    <div className="border-t border-white/5 mt-2 pt-2 px-2">
                      <button
                        onClick={() => {
                          setSettingsMenuOpen(false);
                          handleDownload();
                        }}
                        disabled={isDownloading}
                        className={`w-full text-center px-2 py-1 text-xs rounded ${(!isLoggedIn && !user?.isAdmin) ? 'opacity-50 cursor-not-allowed bg-transparent' : 'bg-gradient-to-r from-cyan-600 to-cyan-500 text-white'}`}
                      >
                        {isDownloading ? (downloadProgress != null ? `تحميل ${downloadProgress}%` : 'جاري التحميل...') : 'تحميل'}
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* زر التحميل */}
              <div className="relative hidden sm:block">
                <button
                  onClick={handleDownload}
                  disabled={isDownloading}
                  className={`flex items-center gap-2 rounded-xl bg-gradient-to-br from-gray-900/90 to-black/90 text-white px-2 py-1 shadow-lg border border-white/10 min-w-[36px] h-8 sm:min-w-[44px] sm:h-10 transition-transform focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 ${!isLoggedIn && !user?.isAdmin ? "opacity-50 cursor-not-allowed" : ""}`}
                  aria-label="تحميل الفيديو"
                >
                  {isDownloading ? (
                    <>
                      <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                      </svg>
                      <span className="font-medium">
                        {downloadProgress != null ? `تحميل ${downloadProgress}%` : "جاري التحميل..."}
                      </span>
                    </>
                  ) : (
                    <>
                      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
                        <path d="M12 3V15" strokeLinecap="round" strokeLinejoin="round" />
                        <path d="M8 11L12 15L16 11" strokeLinecap="round" strokeLinejoin="round" />
                        <path d="M21 21H3" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                      <span className="font-medium">تحميل</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

VideoPlayer.propTypes = {
  video: PropTypes.object,
};

// default props replaced by ES default parameter in function signature

export default React.memo(VideoPlayer);