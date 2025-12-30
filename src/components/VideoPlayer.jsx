import React, {
  useEffect,
  useRef,
  useState,
  useCallback,
} from "react";
import { createPortal } from 'react-dom';
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
  const settingsMenuRef = useRef(null);
  const hlsRef = useRef(null);

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
  // collect transient feedback timers so we can clear them on unmount
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
  const [hoverTime, setHoverTime] = useState(null);
  const [hoverPosPct, setHoverPosPct] = useState(0);

  const handleProgressMouseMove = useCallback((e) => {
    try {
      if (!progressRef.current || !duration || isTouchInput.current) return;
      const rect = progressRef.current.getBoundingClientRect();
      const clientX = (e && e.clientX) || (e.touches && e.touches[0] && e.touches[0].clientX) || 0;
      const x = clientX - rect.left;
      const pct = Math.max(0, Math.min(1, rect.width > 0 ? x / rect.width : 0));
      const seconds = Math.round(pct * duration);
      setHoverPosPct(pct * 100);
      setHoverTime(formatTime(seconds));
    } catch (err) {}
  }, [duration]);

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
      // request fullscreen on the player container itself to avoid touching
      // parent elements (which can cause layout changes or remounts in some browsers)
      const container = containerRef.current || videoRef.current.parentElement;
      if (!container) return;
      // Do NOT set `isFullscreen` here — let the `fullscreenchange` event
      // update state. For entering/exiting we simply invoke the browser API.
      if (!document.fullscreenElement) {
        // Request fullscreen on the player container so overlays/controls
        // that are siblings of the <video> element are also shown in FS.
        if (container.requestFullscreen) container.requestFullscreen();
        else if (container.webkitRequestFullscreen) container.webkitRequestFullscreen();
        else if (container.msRequestFullscreen) container.msRequestFullscreen();
        else {
          // fallback to video element if container FS isn't available
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
              // attempt to resume playback after switching source
              setTimeout(() => {
                try { safePlay(); } catch (e) {}
              }, 250);
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

      // mark that we're in a transition to suppress transient 'waiting' events
      try {
        fullscreenTransitionRef.current = true;
        if (hlsFreezeTimeoutRef.current) {
          clearTimeout(hlsFreezeTimeoutRef.current);
          hlsFreezeTimeoutRef.current = null;
        }

        // Preserve current playback state so we can restore if browser
        // briefly interrupts playback during the FS transition.
        try {
          const v = videoRef.current;
          if (v) {
            savedPosRef.current = v.currentTime || 0;
            wasPlayingRef.current = !v.paused && !v.ended;
          }
        } catch (e) {}

        // If using HLS.js, freeze automatic level switching during the
        // transition to avoid immediate ABR changes that cause buffering.
        try {
          const hls = hlsRef.current;
          if (hls && typeof hls.currentLevel !== 'undefined') {
            prevHlsLevelRef.current = hls.currentLevel;
            try { hls.autoLevelEnabled = false; } catch (e) {}
            try { if (prevHlsLevelRef.current >= 0) hls.currentLevel = prevHlsLevelRef.current; } catch (e) {}
            try { if (prevHlsLevelRef.current >= 0) hls.nextLevel = prevHlsLevelRef.current; } catch (e) {}
          }
        } catch (e) {}

        // end transition flag after a short grace period
        setTimeout(() => {
          try { fullscreenTransitionRef.current = false; } catch (e) {}
        }, 700);
      } catch (e) {}

      setIsFullscreen(isFs);
      setShowControls(true);
      clearHideControls();

      // after the fullscreen transition settle, restore HLS ABR and
      // playback position/state
      hlsFreezeTimeoutRef.current = setTimeout(() => {
        try {
          const hls = hlsRef.current;
          if (hls) {
            try { if (typeof prevHlsLevelRef.current !== 'undefined' && prevHlsLevelRef.current !== null) {
              try { hls.currentLevel = prevHlsLevelRef.current; } catch (e) {}
              try { hls.nextLevel = prevHlsLevelRef.current; } catch (e) {}
            } } catch (e) {}
            try { hls.autoLevelEnabled = true; } catch (e) {}
          }
        } catch (e) {}

        try {
          const v = videoRef.current;
          if (v && savedPosRef.current != null && !isNaN(savedPosRef.current)) {
            try { v.currentTime = savedPosRef.current; } catch (e) {}
          }
          if (v && wasPlayingRef.current) {
            try { v.play(); } catch (e) {}
          }
        } catch (e) {}

        prevHlsLevelRef.current = null;
        hlsFreezeTimeoutRef.current = null;

        if (!isFs) {
          setTimeout(updateVideoSizing, 100);
          scheduleHideControls(3000);
        }
      }, 600);
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
  }, [qualityMenuOpen, speedMenuOpen, settingsMenuOpen]);

  // Close the small fixed settings menu on scroll/resize to avoid misplaced popovers
  useEffect(() => {
    if (!settingsMenuOpen) return;
    const onClose = (e) => {
      // ignore scrolls/resize that originate from inside the settings menu
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
    // use capture to catch scrolls early but ignore those originating inside the menu
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

  // أيقونات SVG مع تصميم محسّن
  const Icons = {
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
    Download: () => (
      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M12 2v8m0 0l3-3m-3 3l-3-3" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M4 12v6a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-6" strokeLinecap="round" />
      </svg>
    ),
  };

  const progressPct = duration ? (currentTime / duration) * 100 : 0;

  return (
    <div className="space-y-2 relative">
      <div
        className={`relative w-full bg-gradient-to-br from-gray-900 via-gray-950 to-black rounded-2xl 
          ${isFullscreen ? "fixed inset-0 z-50 rounded-none overflow-visible" : "aspect-video max-h-[70vh] shadow-2xl overflow-hidden"} ${showControls ? "" : "cursor-none"}`}
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
          onWaiting={() => {
            try {
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
          className="video-player"
        ></video>

        {/* Title overlay shown on the video when controls are visible */}
        {video?.title && (
          <div
            className={`absolute left-4 right-4 top-4 z-50 transition-all duration-300 transform ${showControls ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-4 pointer-events-none"}`}
            style={isFullscreen ? { top: `calc(env(safe-area-inset-top, 0px) + 1rem)` } : undefined}
          >
            <div className="mx-auto max-w-full bg-gradient-to-r from-black/70 via-black/50 to-transparent backdrop-blur-lg text-white/95 rounded-xl px-4 py-3 text-sm sm:text-base font-bold truncate shadow-2xl border border-white/10">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
                {video.title}
              </div>
            </div>
          </div>
        )}

        {/* overlay that intercepts clicks during pending/active long-press */}
        {(isPendingLongPress || isLongPressActive) && (
          <div className="absolute inset-0 z-[100000] bg-gradient-to-br from-red-500/5 to-cyan-500/5" style={{ pointerEvents: 'auto' }} />
        )}

        {/* مؤشر التحميل: تم نقله داخل زر التشغيل المركزي لعدم تكرار الواجهات */}

        {/* ردود الفعل المرئية */}
        {actionFeedback.visible && actionFeedback.position === 'center' && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-40">
            <div className="flex flex-col items-center gap-3 bg-gradient-to-br from-black/70 to-gray-900/70 text-white/95 px-6 py-4 rounded-2xl backdrop-blur-xl border border-white/20 shadow-2xl animate-scale-in">
              <div className="text-4xl bg-gradient-to-r from-red-500 to-cyan-500 bg-clip-text text-transparent">
                {actionFeedback.icon ? actionFeedback.icon() : null}
              </div>
              <div className="text-lg font-bold tracking-wide">{actionFeedback.text}</div>
            </div>
          </div>
        )}

        {actionFeedback.visible && actionFeedback.position === 'top' && (
          <div className="absolute left-1/2 transform -translate-x-1/2 pointer-events-none z-50" style={{ top: '25%' }}>
            <div className="flex flex-col items-center gap-2 bg-gradient-to-br from-black/70 to-gray-900/70 text-white/95 px-4 py-3 rounded-xl backdrop-blur-xl border border-white/20 shadow-2xl animate-scale-in">
              <div className="text-3xl">{actionFeedback.icon ? actionFeedback.icon() : null}</div>
              <div className="text-sm font-bold tracking-wide">{actionFeedback.text}</div>
            </div>
          </div>
        )}

        {actionFeedback.visible && actionFeedback.position === 'left' && (
          <div className="absolute top-1/2 left-8 transform -translate-y-1/2 pointer-events-none z-40 animate-slide-in-left">
            <div className="flex flex-col items-center gap-2 bg-gradient-to-br from-black/70 to-gray-900/70 text-white/95 px-4 py-3 rounded-xl backdrop-blur-xl border border-white/20 shadow-2xl">
              <div className="text-3xl">{actionFeedback.icon ? actionFeedback.icon() : null}</div>
              <div className="text-sm font-bold tracking-wide">{actionFeedback.text}</div>
            </div>
          </div>
        )}

        {actionFeedback.visible && actionFeedback.position === 'right' && (
          <div className="absolute top-1/2 right-8 transform -translate-y-1/2 pointer-events-none z-40 animate-slide-in-right">
            <div className="flex flex-col items-center gap-2 bg-gradient-to-br from-black/70 to-gray-900/70 text-white/95 px-4 py-3 rounded-xl backdrop-blur-xl border border-white/20 shadow-2xl">
              <div className="text-3xl">{actionFeedback.icon ? actionFeedback.icon() : null}</div>
              <div className="text-sm font-bold tracking-wide">{actionFeedback.text}</div>
            </div>
          </div>
        )}

        {seekFeedback.visible && !actionFeedback.visible && (
          <div className={`absolute top-1/2 transform -translate-y-1/2 ${seekFeedback.type === "forward" ? "right-8" : "left-8"} pointer-events-none z-40 animate-slide-in-${seekFeedback.type === "forward" ? "right" : "left"}`}>
            <div className="flex flex-col items-center gap-2 bg-gradient-to-br from-black/70 to-gray-900/70 text-white/95 px-4 py-3 rounded-xl backdrop-blur-xl border border-white/20 shadow-2xl">
              <div className="text-3xl">
                {seekFeedback.type === "forward" ? <Icons.Forward10 /> : <Icons.Replay10 />}
              </div>
              <div className="text-sm font-bold tracking-wide">{seekFeedback.time}</div>
            </div>
          </div>
        )}

        {rateFeedback.visible && !actionFeedback.visible && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-40">
            <div className="flex flex-col items-center gap-2 bg-gradient-to-br from-black/70 to-gray-900/70 text-white/95 px-6 py-4 rounded-2xl backdrop-blur-xl border border-white/20 shadow-2xl animate-scale-in">
              <div className="text-3xl font-bold bg-gradient-to-r from-red-500 to-cyan-500 bg-clip-text text-transparent">{rateFeedback.rate}x</div>
              <div className="text-sm font-medium opacity-80">سرعة التشغيل</div>
            </div>
          </div>
        )}

        {volumeFeedback.visible && !actionFeedback.visible && (
          <div className="absolute left-1/2 transform -translate-x-1/2 z-40 pointer-events-none animate-slide-in-top" style={{ top: '6%' }}>
            <div className="flex flex-col items-center gap-1 bg-gradient-to-br from-black/70 to-gray-900/70 text-white/95 px-4 py-3 rounded-xl backdrop-blur-xl border border-white/20 shadow-2xl">
              <div className="text-sm opacity-80">مستوى الصوت</div>
              <div className="text-2xl font-bold bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent">{volumeFeedback.volume}%</div>
              <div className="w-32 h-2 bg-gray-700 rounded-full overflow-hidden mt-1">
                <div 
                  className="h-full bg-gradient-to-r from-cyan-500 to-blue-500 rounded-full transition-all duration-300"
                  style={{ width: `${volumeFeedback.volume}%` }}
                />
              </div>
            </div>
          </div>
        )}

        {/* تقدم التحميل */}
        {isDownloading && downloadProgress != null && (
          <div
            className="absolute left-1/2 -translate-x-1/2 bottom-4 z-40 pointer-events-none w-2/5 animate-pulse"
            style={isFullscreen ? { bottom: `calc(1rem + env(safe-area-inset-bottom) + ${fullscreenBottomInset}px)` } : undefined}
          >
            <div className="w-full h-2.5 bg-white/20 rounded-full overflow-hidden shadow-inner">
              <div
                className="h-full bg-gradient-to-r from-cyan-500 via-blue-500 to-purple-500 rounded-full transition-all duration-300 shadow-lg"
                style={{ width: `${downloadProgress}%` }}
              />
            </div>
            <div className="text-center mt-2 text-sm font-bold text-white/90 tracking-wide">
              جاري التحميل {downloadProgress}%
            </div>
          </div>
        )}

        {/* رسالة الخطأ */}
        {error && showErrorOverlay && (
          <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-black/95 via-gray-900/95 to-black/95 backdrop-blur-xl animate-fade-in" style={{ zIndex: 2147483647, pointerEvents: 'auto' }}>
            <div className="text-center p-8 bg-gradient-to-br from-gray-900 to-black rounded-3xl max-w-sm border border-white/10 shadow-2xl">
              <div className="text-red-400 text-2xl mb-4 font-bold flex items-center justify-center gap-3">
                <span className="text-3xl animate-pulse">⚠️</span> 
                <span className="bg-gradient-to-r from-red-400 to-orange-400 bg-clip-text text-transparent">{error}</span>
              </div>
              <button
                onClick={retryPlayback}
                className="px-8 py-3.5 bg-gradient-to-r from-red-600 via-orange-500 to-red-700 text-white rounded-xl transition-all duration-300 shadow-lg hover:shadow-red-500/25 hover:scale-105 active:scale-95 font-bold text-lg"
              >
                إعادة المحاولة
              </button>
            </div>
          </div>
        )}

        {/* عناصر التحكم المركزية */}
        {showControls && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-[99999] animate-fade-in">
            <div className="flex items-center gap-4 sm:gap-6 md:gap-8 pointer-events-auto">
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
                className="controls-button flex items-center justify-center w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-gradient-to-br from-gray-900/80 to-black/80 text-white shadow-2xl transition-all duration-300 hover:scale-110 hover:shadow-cyan-500/25 active:scale-95 backdrop-blur-sm"
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
                className={`controls-button center-control flex items-center justify-center w-16 h-16 md:w-20 md:h-20 rounded-full ${loading ? "bg-gradient-to-br from-gray-800 to-black" : "bg-gradient-to-br from-red-600 via-red-500 to-orange-500"} text-white shadow-3xl transition-all duration-300 hover:scale-105 hover:shadow-red-500/50 active:scale-95 z-[99999] relative overflow-hidden group`}
                disabled={loading}
              >
                {loading ? (
                  <svg className="w-10 h-10 text-white animate-spin" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                  </svg>
                ) : (isPlaying ? <Icons.PauseCircle /> : <Icons.PlayArrow />)}
                
                {/* تأثير توهج */}
                <div className={`absolute inset-0 rounded-full ${isPlaying ? "bg-gradient-to-r from-red-500/20 to-orange-500/20" : "bg-gradient-to-r from-red-600/20 to-cyan-500/20"} blur-xl group-hover:blur-2xl transition-all duration-500`}></div>
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
                className="controls-button flex items-center justify-center w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-gradient-to-br from-gray-900/80 to-black/80 text-white shadow-2xl transition-all duration-300 hover:scale-110 hover:shadow-cyan-500/25 active:scale-95 backdrop-blur-sm z-[99999]"
              >
                <Icons.Forward10 />
              </button>
            </div>
          </div>
        )}

        {/* شريط التقدم */}
        <div
          className={`absolute left-0 right-0 bottom-16  transition-all duration-300 transform z-50 bg-gradient-to-t from-black/60 via-black/40 to-transparent backdrop-blur-sm ${showControls ? "opacity-100 translate-y-0 pointer-events-auto" : "opacity-0 translate-y-4 pointer-events-none"}`}
          style={isFullscreen ? { bottom: `calc(4rem + env(safe-area-inset-bottom) + ${fullscreenBottomInset}px)` } : undefined}
        >
          <div className="flex items-center gap-3 px-4 py-3">
            <div className="text-white/90 font-bold text-sm bg-black/30 px-3 py-1.5 rounded-lg">
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
              <span className="text-white/60 ml-2 font-medium">/ {formatTime(duration)}</span>
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
                className={`relative cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 h-2.5 sm:h-3 bg-gradient-to-r from-gray-800/40 to-gray-800/20 rounded-full shadow-inner overflow-hidden group`}
                onClick={handleSeek}
                onMouseDown={handlePointerSeekStart}
                onMouseEnter={(e) => { setHoverProgress(true); handleProgressMouseMove && handleProgressMouseMove(e); }}
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
                  className={`absolute top-0 h-full rounded-full shadow-lg transition-all duration-300 ${hoverProgress ? "bg-gradient-to-r from-red-500 via-cyan-500 to-blue-600" : "bg-gradient-to-r from-red-600 via-red-500 to-orange-500"}`}
                  style={{
                    [isProgressRtl() ? "right" : "left"]: 0,
                    width: `${progressPct}%`,
                    zIndex: 1,
                  }}
                />

                <div
                  className={`absolute top-1/2 -translate-y-1/2 cursor-pointer transition-all duration-300 rounded-full ${hoverProgress ? "w-4 h-4 bg-white shadow-xl border-2 border-cyan-400" : "w-3 h-3 bg-white shadow-lg border-2 border-red-500"} group-hover:w-4 group-hover:h-4`}
                  style={{
                    [isProgressRtl() ? "right" : "left"]: `${progressPct}%`,
                      transform: isProgressRtl() ? "translate(50%, -50%)" : "translate(-50%, -50%)",
                      zIndex: 2,
                  }}
                  aria-hidden
                />
              </div>
            </div>
          </div>
        </div>

        {/* زر ملء الشاشة */}
        <div
          className={`absolute left-4 bottom-6 z-[9999999] transition-all duration-300 transform ${showControls ? "opacity-100 translate-y-0 pointer-events-auto" : "opacity-0 translate-y-4 pointer-events-none"}`}
          style={isFullscreen ? { bottom: `calc(1.5rem + env(safe-area-inset-bottom) + ${fullscreenBottomInset}px)` } : undefined}
        >
          <button
            type="button"
            onClick={toggleFullscreen}
            ref={fsButtonRef}
            className="flex items-center justify-center rounded-xl bg-gradient-to-br from-gray-900/90 to-black/90 text-white w-12 h-12 shadow-2xl transition-all duration-300 hover:scale-110 hover:shadow-cyan-500/25 active:scale-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 backdrop-blur-sm border border-white/10"
            aria-label={isFullscreen ? "خروج من ملء الشاشة" : "ملء الشاشة"}
          >
            {isFullscreen ? <Icons.FullscreenExit /> : <Icons.Fullscreen />}
          </button>
        </div>

        {/* عناصر التحكم السفلية */}
        <div
          className={`absolute left-0 right-0 bottom-4 px-4 transition-all duration-300 transform z-[99999] bg-gradient-to-t from-black/70 via-black/50 to-transparent backdrop-blur-lg ${showControls ? "opacity-100 translate-y-0 pointer-events-auto" : "opacity-0 translate-y-4 pointer-events-none"}`}
        >
          <div className="flex flex-row items-center justify-between gap-3 sm:gap-5">
            <div className="flex items-center gap-3 sm:gap-4 flex-wrap w-full sm:w-auto justify-start">
              <button
                onClick={togglePlayPauseImmediate}
                className="controls-button flex items-center justify-center rounded-xl bg-gradient-to-br from-gray-900 to-black w-12 h-12 text-white shadow-2xl transition-all duration-300 hover:scale-110 hover:shadow-cyan-500/25 active:scale-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 backdrop-blur-sm border border-white/10"
                aria-label={isPlaying ? "إيقاف" : "تشغيل"}
              >
                {isPlaying ? <Icons.Pause /> : <Icons.Play />}
              </button>

              <div className="flex items-center gap-2 bg-black/40 backdrop-blur-sm rounded-xl px-3 py-2 border border-white/10 volume-container">
                <button
                  onClick={() => {
                    if (volume > 0) {
                      prevVolumeRef.current = volume;
                      setVolume(0);
                    } else {
                      setVolume(prevVolumeRef.current > 0 ? prevVolumeRef.current : 1);
                    }
                  }}
                  className="controls-button flex items-center justify-center text-white transition-transform duration-200 hover:scale-110 active:scale-95"
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
                  className="volume-slider hidden sm:block w-0 sm:w-32 ml-2 transition-all duration-200 opacity-0"
                  aria-label="مستوى الصوت"
                />
              </div>

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
                  className="controls-button flex items-center gap-3 rounded-xl bg-gradient-to-br from-gray-900/90 to-black/90 text-white px-4 py-3 shadow-2xl border border-white/10 transition-all duration-300 hover:scale-105 hover:shadow-cyan-500/25 active:scale-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 backdrop-blur-sm"
                  aria-expanded={qualityMenuOpen}
                  aria-label="اختيار الجودة"
                >
                  <Icons.Quality />
                  <span className="font-bold tracking-wide">
                    {currentQuality ? `${currentQuality}p` : "الجودة"}
                  </span>
                  <Icons.ChevronDown />
                </button>
                {qualityMenuOpen && video && video.qualities && (
                  <div className="absolute bottom-16 right-0 bg-gradient-to-b from-gray-900 to-black border border-white/20 rounded-2xl shadow-2xl py-2 z-50 w-56 backdrop-blur-xl max-h-60 overflow-y-auto animate-scale-in">
                    <div className="px-3 py-2 text-xs text-white/80 font-bold border-b border-white/10">اختر الجودة</div>
                    {[...video.qualities]
                      .sort((a, b) => parseInt(a.quality) - parseInt(b.quality))
                      .map((q) => (
                        <button
                          key={q.quality}
                          onClick={() => handleQualityChangePersist(q.quality)}
                          className={`w-full text-right px-5 py-3 text-sm transition-all duration-200 ${String(q.quality) === String(currentQuality) ? "bg-gradient-to-r from-red-600 to-red-800 text-white font-bold" : "text-white/80 hover:bg-white/10 hover:text-white"}`}
                        >
                          <span className="flex items-center justify-between">
                            <span className="text-xs opacity-70">{RES_MAP[q.quality] ? `${RES_MAP[q.quality].w}×${RES_MAP[q.quality].h}` : ""}</span>
                            {q.quality}p
                          </span>
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
                    className="controls-button flex items-center gap-3 rounded-xl bg-gradient-to-br from-gray-900/90 to-black/90 text-white px-4 py-3 shadow-2xl border border-white/10 transition-all duration-300 hover:scale-105 hover:shadow-cyan-500/25 active:scale-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 backdrop-blur-sm"
                  aria-expanded={speedMenuOpen}
                  aria-label="اختيار السرعة"
                >
                  <Icons.Speed />
                  <span className="font-bold tracking-wide">{playbackRate.toFixed(2)}x</span>
                  <Icons.ChevronDown />
                </button>
                {speedMenuOpen && (
                  <div className="absolute bottom-16 right-0 bg-gradient-to-b from-gray-900 to-black border border-white/20 rounded-2xl shadow-2xl w-64 p-4 backdrop-blur-xl z-50 animate-scale-in">
                    <div className="flex flex-col items-center w-full gap-4 mb-3">
                      <div className="text-lg font-bold text-white/90 mb-2">سرعة التشغيل</div>
                      <div className="flex items-center justify-center gap-4 w-full">
                        <button
                          onClick={() => adjustRate(-0.05)}
                          className="bg-gradient-to-br from-gray-800 to-black text-white rounded-full w-10 h-10 flex items-center justify-center text-xl shadow-lg transition-all hover:scale-110 active:scale-95 border border-white/10"
                        >
                          −
                        </button>
                        <div className="text-3xl font-bold bg-gradient-to-r from-red-500 to-cyan-500 bg-clip-text text-transparent">
                          {playbackRate.toFixed(2)}x
                        </div>
                        <button
                          onClick={() => adjustRate(0.05)}
                          className="bg-gradient-to-br from-gray-800 to-black text-white rounded-full w-10 h-10 flex items-center justify-center text-xl shadow-lg transition-all hover:scale-110 active:scale-95 border border-white/10"
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

                    // debug: log values so we can inspect why menu may not appear
                    try {
                      // eslint-disable-next-line no-console
                      console.debug('[VideoPlayer] settings click', { willOpen, settingsMenuOpen, settingsMenuPos, rect: settingsRef.current && settingsRef.current.getBoundingClientRect() });
                    } catch (e) {}
                  }}
                  aria-expanded={settingsMenuOpen}
                  onMouseDown={(e) => e.stopPropagation()}
                  className="controls-button settings-button flex items-center justify-center rounded-xl bg-gradient-to-br from-gray-900/90 to-black/90 text-white px-3 py-3 shadow-2xl border border-white/10 w-12 h-12 transition-all duration-300 hover:scale-110 hover:shadow-cyan-500/25 active:scale-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 backdrop-blur-sm"
                  aria-label="الإعدادات"
                >
                  <Icons.Settings />
                </button>
                {settingsMenuOpen && (typeof document !== 'undefined' ? createPortal(
                  <div
                    ref={settingsMenuRef}
                    className="fixed bg-gradient-to-b from-gray-900 to-black border border-white/20 rounded-2xl shadow-2xl z-[99999] w-40 max-h-64 overflow-y-auto backdrop-blur-xl p-3 animate-scale-in"
                    style={settingsMenuPos ? { left: `${settingsMenuPos.left}px`, top: `${settingsMenuPos.top}px` } : { right: '0.75rem', bottom: '5rem' }}
                  >
                    <div className="px-2 pt-1 text-xs text-white/80 font-bold mb-2">الجودة</div>
                    {video &&
                      video.qualities &&
                      [...video.qualities]
                        .sort((a, b) => parseInt(a.quality) - parseInt(b.quality))
                        .map((q) => (
                          <button
                            key={q.quality}
                            onClick={() => handleQualityChangePersist(q.quality)}
                            className={`w-full text-right px-3 py-2.5 text-sm rounded-lg transition-all duration-200 mb-1 ${String(q.quality) === String(currentQuality) ? "bg-gradient-to-r from-red-600 to-red-800 text-white font-bold" : "text-white/80 hover:bg-white/10 hover:text-white"}`}
                          >
                            {q.quality}p
                          </button>
                        ))}
                    <div className="px-2 pt-3 text-xs text-white/80 flex items-center justify-between mb-2">
                      <div className="text-xs font-bold">السرعة</div>
                      <div className="font-bold text-white text-sm">{playbackRate.toFixed(2)}x</div>
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
                        className="w-full accent-gradient"
                      />
                    </div>
                    <div className="border-t border-white/10 mt-2 pt-2 px-2">
                      <button
                        onClick={() => {
                          setSettingsMenuOpen(false);
                          handleDownload();
                        }}
                        disabled={isDownloading}
                        className={`w-full text-center px-3 py-2.5 text-sm rounded-lg transition-all duration-200 ${(!isLoggedIn && !user?.isAdmin) ? 'opacity-50 cursor-not-allowed bg-transparent' : 'bg-gradient-to-r from-cyan-600 to-blue-500 text-white font-bold shadow-lg hover:shadow-cyan-500/25'}`}
                      >
                        {isDownloading ? (downloadProgress != null ? `تحميل ${downloadProgress}%` : 'جاري التحميل...') : 'تحميل الفيديو'}
                      </button>
                    </div>
                  </div>,
                  // when player is in fullscreen render the menu inside the fullscreen element
                  (isFullscreen && typeof document !== 'undefined' && document.fullscreenElement) ? document.fullscreenElement : document.body
                ) : null)}
              </div>

              {/* زر التحميل */}
              <div className="relative hidden sm:block">
                <button
                  onClick={handleDownload}
                  disabled={isDownloading}
                  className={`flex items-center gap-3 rounded-xl bg-gradient-to-br from-gray-900/90 to-black/90 text-white px-4 py-3 shadow-2xl border border-white/10 transition-all duration-300 hover:scale-105 hover:shadow-cyan-500/25 active:scale-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 backdrop-blur-sm ${!isLoggedIn && !user?.isAdmin ? "opacity-50 cursor-not-allowed" : ""}`}
                  aria-label="تحميل الفيديو"
                >
                  {isDownloading ? (
                    <>
                      <svg className="w-5 h-5 animate-spin" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                      </svg>
                      <span className="font-bold tracking-wide">
                        {downloadProgress != null ? `تحميل ${downloadProgress}%` : "جاري التحميل..."}
                      </span>
                    </>
                  ) : (
                    <>
                      <Icons.Download />
                      <span className="font-bold tracking-wide">تحميل</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      {/* إضافة الأنيميشن في الـCSS */}
      <style>{`
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
        
        .accent-gradient {
          background: linear-gradient(to right, #ef4444, #3b82f6);
          height: 6px;
          border-radius: 3px;
          outline: none;
        }
        
        .accent-gradient::-webkit-slider-thumb {
          appearance: none;
          width: 18px;
          height: 18px;
          border-radius: 50%;
          background: white;
          border: 2px solid #3b82f6;
          cursor: pointer;
          box-shadow: 0 0 10px rgba(59, 130, 246, 0.5);
        }
        
        .accent-gradient::-moz-range-thumb {
          width: 18px;
          height: 18px;
          border-radius: 50%;
          background: white;
          border: 2px solid #3b82f6;
          cursor: pointer;
          box-shadow: 0 0 10px rgba(59, 130, 246, 0.5);
        }
        
        .video-player {
          filter: brightness(1.05);
        }
        
        .video-player:fullscreen {
          filter: brightness(1.1);
        }

        /* Volume slider: hidden until hover (desktop) */
        .volume-container {
          display: inline-flex;
          align-items: center;
        }

        .volume-container .volume-slider {
          width: 0;
          opacity: 0;
          transform: scaleX(0);
          transition: all 180ms ease-in-out;
          overflow: hidden;
        }

        .volume-container:hover .volume-slider,
        .volume-slider:focus {
          width: 80px;
          opacity: 1;
          transform: scaleX(1);
        }

        /* Responsive: shrink controls on small screens and make center icon slightly larger */
        @media (max-width: 640px) {
          /* make controls noticeably smaller on very small screens */
          .controls-button {
            width: 32px !important;
            height: 32px !important;
            padding: 0.12rem !important;
            border-radius: 0.4rem !important;
          }

          /* shrink default svg icons inside control buttons */
          .controls-button svg {
            width: 12px !important;
            height: 12px !important;
          }

          /* center control remains slightly larger than side buttons */
          .center-control {
            width: 40px !important;
            height: 40px !important;
          }

          .center-control svg {
            width: 22px !important;
            height: 22px !important;
          }

          /* make the large center play icon a bit smaller on very small screens */
          .center-control .w-10, .center-control .h-10, .center-control .w-12, .center-control .h-12 {
            width: 20px !important;
            height: 20px !important;
          }

          /* slightly reduce progress bar height for compact layout */
          .relative.cursor-pointer.h-2.5 {
            height: 6px !important;
          }

          /* volume slider hidden by default and expands on hover */
          .volume-container .volume-slider {
            width: 0 !important;
            opacity: 0 !important;
            transform: scaleX(0) !important;
            transition: all 180ms ease-in-out !important;
          }

          .volume-container:hover .volume-slider, .volume-slider:focus {
            width: 80px !important;
            opacity: 1 !important;
            transform: scaleX(1) !important;
          }

          /* larger settings icon so it doesn't crowd other icons */
          .settings-button {
            width: 44px !important;
            height: 44px !important;
          }

          .settings-button svg {
            width: 20px !important;
            height: 20px !important;
          }

          .relative.cursor-pointer .-translate-y-1\/2 {
            transform: translate(-50%, -50%) !important;
          }
        }
      `}</style>
    </div>
  );
}

VideoPlayer.propTypes = {
  video: PropTypes.object,
};

// default props replaced by ES default parameter in function signature

export default React.memo(VideoPlayer);