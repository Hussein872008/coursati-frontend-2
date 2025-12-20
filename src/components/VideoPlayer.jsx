import React, {
  useEffect,
  useRef,
  useState,
  useCallback,
  useMemo,
} from "react";
import { videosAPI } from "../utils/api";
import api from "../utils/api";
import { useAuth } from "../hooks/useAuth";

function VideoPlayer({ video }) {
  const videoRef = useRef(null);
  const hlsRef = useRef(null);
  const isTouchRef = useRef(false);
  const globalRetriesRef = useRef(0);
  const fragRetriesRef = useRef({});
  const mediaErrorRetriesRef = useRef(0);
  const [currentQuality, setCurrentQuality] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [volume, setVolume] = useState(1);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [bufferedPercent, setBufferedPercent] = useState(0);
  const [qualityMenuOpen, setQualityMenuOpen] = useState(false);
  const [speedMenuOpen, setSpeedMenuOpen] = useState(false);
  const [settingsMenuOpen, setSettingsMenuOpen] = useState(false);
  const qualityRef = useRef(null);
  const speedRef = useRef(null);
  const settingsRef = useRef(null);
  const controlsRef = useRef(null);
  const progressRef = useRef(null);
  const [manifestParsed, setManifestParsed] = useState(false);
  const [availableLevels, setAvailableLevels] = useState(0);
  const [showNativeControls, setShowNativeControls] = useState(false);

  // container ref for IntersectionObserver (lazy init) and visibility
  const containerRef = useRef(null);
  const [shouldInit, setShouldInit] = useState(false);
  const [isVisible, setIsVisible] = useState(false);

  // تحسينات للتحكم باللمس
  const [isTouchDevice, setIsTouchDevice] = useState(false);
  const [showTouchControls, setShowTouchControls] = useState(true);
  const touchControlsTimeout = useRef(null);
  const [lastTapTime, setLastTapTime] = useState(0);
  const tapTimeout = useRef(null);
  const doubleTapHandledRef = useRef(false);
  const touchStartTimeRef = useRef(0);
  const touchStartXRef = useRef(0);
  const touchStartYRef = useRef(0);

  // refs for long-press and touch hide timers
  const longPressTimerRef = useRef(null);
  const longPressActiveRef = useRef(false);
  const prevRateRef = useRef(null);
  const prevVolumeRef = useRef(null);
  const touchHideTimeoutRef = useRef(null);
  const hideControlsTimeoutRef = useRef(null);
  const lastRenderedTimeRef = useRef(0);
  const clearHideControls = () => {
    if (hideControlsTimeoutRef.current) {
      clearTimeout(hideControlsTimeoutRef.current);
      hideControlsTimeoutRef.current = null;
    }
    if (touchHideTimeoutRef.current) {
      clearTimeout(touchHideTimeoutRef.current);
      touchHideTimeoutRef.current = null;
    }
  };

  const scheduleHideControls = (delay = 3000) => {
    clearHideControls();
    if (qualityMenuOpen || speedMenuOpen) return;
    const ref = isTouchDevice ? touchHideTimeoutRef : hideControlsTimeoutRef;
    // schedule hide after `delay` (consistent across play/pause)
    ref.current = setTimeout(() => {
      setShowControls(false);
    }, delay);
  };
  // separate ref to store last touch/tap info (avoid clobbering lastRenderedTimeRef)
  const lastTouchInfoRef = useRef({});

  // تحسين: زيادة حساسية شريط التقدم على اللمس
  const progressDragRef = useRef(false);
  const progressDragStartXRef = useRef(0);
  const progressDragStartTimeRef = useRef(0);

  // Fixed resolution mapping requested by user
  const RES_MAP = {
    360: { w: 640, h: 360 },
    480: { w: 848, h: 480 },
    720: { w: 1280, h: 720 },
  };

  // كشف إذا كان الجهاز يدعم اللمس
  useEffect(() => {
    const checkTouchDevice = () => {
      const isTouch = "ontouchstart" in window || navigator.maxTouchPoints > 0;
      setIsTouchDevice(isTouch);
      isTouchRef.current = isTouch;
      if (isTouch) {
        // إظهار عناصر التحكم لفترة أطول على الأجهزة اللمسية
        setShowControls(true);
        setShowTouchControls(true);
      }
    };

    checkTouchDevice();
    window.addEventListener("resize", checkTouchDevice);

    return () => {
      window.removeEventListener("resize", checkTouchDevice);
    };
  }, []);

  // Lazy-init: observe container and only initialize streaming when visible
  useEffect(() => {
    try {
      if (shouldInit) return;
      const el = containerRef.current;
      if (!el) return;
      const obs = new IntersectionObserver(
        (entries) => {
          entries.forEach((ent) => {
            if (ent.isIntersecting) {
              setIsVisible(true);
              setShouldInit(true);
              try {
                obs.disconnect();
              } catch (e) { }
            }
          });
        },
        { threshold: 0.25 },
      );
      obs.observe(el);
      return () => {
        try {
          obs.disconnect();
        } catch (e) { }
      };
    } catch (e) { }
  }, []);

  useEffect(() => {
    if (!video || !video.qualities || video.qualities.length === 0) return;
    const qualities = [...video.qualities].map((q) => String(q.quality));
    // If the user has a saved preferred quality for this video, use it.
    // Otherwise (first time) default to the lowest available quality to save bandwidth.
    try {
      const saved = localStorage.getItem(`video-default-quality-${video._id}`);
      if (saved && qualities.includes(String(saved))) {
        setCurrentQuality(String(saved));
        return;
      }
    } catch (e) {
      /* ignore localStorage errors */
    }

    // choose lowest available (numeric ascending)
    const sorted = qualities.sort(
      (a, b) => parseInt(a || "0") - parseInt(b || "0"),
    );
    const preferred = sorted[0] || qualities[0];
    setCurrentQuality(preferred);
  }, [video]);

  // load persisted settings
  useEffect(() => {
    try {
      const sv = localStorage.getItem("video-volume");
      const sr = localStorage.getItem("video-rate");
      if (sv !== null) setVolume(parseFloat(sv));
      if (sr !== null) setPlaybackRate(parseFloat(sr));
    } catch (e) { }
  }, []);

  // If server provides duration, use it immediately so UI shows correct total time
  useEffect(() => {
    try {
      const serverDuration = (video && Number(video.duration)) || 0;
      if (serverDuration > 0) setDuration(serverDuration);
    } catch (e) { }
  }, [video]);

  useEffect(() => {
    if (!video || !currentQuality || !shouldInit) return;
    setLoading(true);
    setError(null);

    // include userCode (if available) so backend authMiddleware can validate playlist requests
    const userCode =
      typeof window !== "undefined" ? localStorage.getItem("userCode") : null;
    // Prefer explicit backend base from axios instance (VITE_API_BASE). Fallback to relative path.
    const backendBaseRaw =
      api && api.defaults && api.defaults.baseURL ? api.defaults.baseURL : "";
    const backendBase = backendBaseRaw ? backendBaseRaw.replace(/\/$/, "") : "";
    const pathPart = `/api/videos/${video._id}/playlist/${currentQuality}.m3u8`;
    const playlistUrl =
      (backendBase ? `${backendBase}${pathPart}` : pathPart) +
      (userCode ? `?userCode=${encodeURIComponent(userCode)}` : "");

    // Destroy previous hls instance
    if (hlsRef.current) {
      try {
        hlsRef.current.destroy();
      } catch (e) { }
      hlsRef.current = null;
    }

    // use refs for retry counters to avoid re-renders
    globalRetriesRef.current = 0;
    const maxGlobalRetries = 3;

    (async () => {
      let HlsModule = null;
      try {
        const mod = await import("hls.js");
        HlsModule = mod && (mod.default || mod);
      } catch (e) {
        HlsModule = null;
      }

      if (HlsModule && HlsModule.isSupported && HlsModule.isSupported()) {
        const hls = new HlsModule({
          xhrSetup: (xhr, url) => {
            xhr.withCredentials = false;
          },
          enableWorker: true,
          capLevelToPlayerSize: true,
          lowLatencyMode: false,
          // reduced buffers to lower memory & CPU under high concurrency
          maxBufferLength: 15,
          maxMaxBufferLength: 30,
          backBufferLength: 10,
          maxBufferSize: 20 * 1000 * 1000,
          autoStartLoad: true,
          abrBandWidthFactor: 0.85,
          abrBandWidthUpFactor: 0.8,
        });

        fragRetriesRef.current = {};
        mediaErrorRetriesRef.current = 0;
        hlsRef.current = hls;
        try {
          hls.loadSource(playlistUrl);
        } catch (e) { }
        try {
          hls.attachMedia(videoRef.current);
        } catch (e) { }

        hls.on(HlsModule.Events.MANIFEST_PARSED, () => {
          setLoading(false);
          setManifestParsed(true);
          setAvailableLevels((hls.levels && hls.levels.length) || 0);
          const serverDuration = (video && Number(video.duration)) || 0;
          if (serverDuration > 0) setDuration(serverDuration);
          else if (videoRef.current)
            setDuration(videoRef.current.duration || 0);
          try {
            if (currentQuality) {
              applyQualityToHls(hls, currentQuality);
              try {
                hls.autoLevelEnabled = false;
              } catch (e) { }
            }
          } catch (e) { }
        });

        hls.on(HlsModule.Events.ERROR, (event, data) => {
          try {
            if (
              data &&
              data.type === HlsModule.ErrorTypes.NETWORK_ERROR &&
              data.details &&
              data.details.indexOf("fragLoad") === 0
            ) {
              const url = data?.response?.url || data?.frag?.url;
              const status = data?.response?.status;
              if (
                (status === 401 || status === 403) &&
                url &&
                video &&
                video._id
              ) {
                try {
                  const m = url.match(/\/segments\/(\d+)\/(\d+)/);
                  if (m) {
                    const qFromUrl = m[1];
                    const segNum = m[2];
                    videosAPI
                      .signSegment(video._id, qFromUrl, segNum)
                      .then((res) => {
                        try {
                          const newToken = res && res.data && res.data.token;
                          if (newToken) {
                            let newUrl = url;
                            if (/token=/.test(newUrl)) {
                              newUrl = newUrl.replace(
                                /([?&])token=[^&]*/,
                                `$1token=${encodeURIComponent(newToken)}`,
                              );
                            } else {
                              const sep = newUrl.includes("?") ? "&" : "?";
                              newUrl = `${newUrl}${sep}token=${encodeURIComponent(newToken)}`;
                            }
                            if (data && data.frag) data.frag.url = newUrl;
                            setTimeout(() => {
                              try {
                                hls.startLoad();
                              } catch (e) { }
                            }, 200);
                            return;
                          }
                        } catch (e) { }
                      })
                      .catch(() => { });
                  }
                } catch (err) { }
              }

              if (url) {
                fragRetriesRef.current[url] =
                  (fragRetriesRef.current[url] || 0) + 1;
                const retries = fragRetriesRef.current[url];
                if (retries <= 3) {
                  const backoff = 300 * Math.pow(2, retries - 1);
                  setTimeout(() => {
                    try {
                      hls.startLoad();
                    } catch (e) { }
                  }, backoff);
                  return;
                }
              }
            }

            if (data && data.type === HlsModule.ErrorTypes.MEDIA_ERROR) {
              mediaErrorRetriesRef.current =
                (mediaErrorRetriesRef.current || 0) + 1;
              if (mediaErrorRetriesRef.current <= 2) {
                try {
                  hls.recoverMediaError();
                } catch (e) { }
                setTimeout(() => {
                  try {
                    if (hls) hls.startLoad();
                  } catch (e) { }
                }, 400);
                return;
              }
              try {
                hls.startLoad();
              } catch (e) { }
              setError("حدث خطأ في فك ترميز الوسائط");
              return;
            }

            if (data && data.type === HlsModule.ErrorTypes.NETWORK_ERROR) {
              if (globalRetriesRef.current < maxGlobalRetries) {
                globalRetriesRef.current += 1;
                const backoff = 500 * Math.pow(2, globalRetriesRef.current - 1);
                setTimeout(() => {
                  try {
                    hls.startLoad();
                  } catch (e) { }
                }, backoff);
                return;
              }
            }

            setError("حدث خطأ أثناء التشغيل");
          } catch (err) { }
        });

        hls.on(HlsModule.Events.LEVEL_SWITCHED, () => {
          try {
            hls.startLoad();
          } catch (e) { }
        });
      } else {
        try {
          videoRef.current.src = playlistUrl;
        } catch (e) { }
        const onLoaded = () => {
          setLoading(false);
          const serverDuration = (video && Number(video.duration)) || 0;
          if (serverDuration > 0) setDuration(serverDuration);
          else setDuration(videoRef.current.duration || 0);
        };
        const onErr = () => setError("Playback failed");
        try {
          videoRef.current.addEventListener("loadedmetadata", onLoaded);
        } catch (e) { }
        try {
          videoRef.current.addEventListener("error", onErr);
        } catch (e) { }
      }
    })();

    // ensure dimensions applied when hls or video change
    try {
      updateVideoSizing();
    } catch (e) { }

    // متابعة الوقت الحالي
    const updateTime = () => {
      const v = videoRef.current;
      if (!v) return;
      const now = v.currentTime || 0;
      // update UI time only when a meaningful change occurred to avoid re-renders
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
            // only update if buffer changed enough
            if (Math.abs(pct - (bufferedPercent || 0)) > 1)
              setBufferedPercent(pct);
          }
        }
      } catch (e) { }
    };

    // Use a rAF-driven loop throttled to ~250ms to reduce UI updates and CPU
    let rafId = null;
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
    // keep timeupdate listener for immediate UI feedback, but updateTime is throttled
    videoRef.current?.addEventListener("timeupdate", updateTime);

    // resume playback position
    try {
      const saved = localStorage.getItem(`video-pos-${video._id}`);
      if (saved) {
        const t = parseFloat(saved);
        if (!isNaN(t) && videoRef.current) {
          videoRef.current.currentTime = t;
          updateTime();
        }
      }
    } catch (e) { }

    const saveInt = setInterval(() => {
      try {
        if (videoRef.current && !isNaN(videoRef.current.currentTime)) {
          localStorage.setItem(
            `video-pos-${video._id}`,
            String(videoRef.current.currentTime),
          );
        }
      } catch (e) { }
    }, 5000); // reduce write frequency to localStorage under heavy load

    // apply persisted volume and playback rate
    try {
      if (videoRef.current) {
        videoRef.current.volume = volume;
        videoRef.current.playbackRate = playbackRate;
      }
    } catch (e) { }

    // التحكم في إظهار/إخفاء عناصر التحكم
    if (!isTouchDevice) {
      hideControlsTimeoutRef.current = setTimeout(() => {
        setShowControls(false);
      }, 3000);
    }

    const handleContainerClick = (e) => {
      // show controls on single click (do not toggle playback here)
      setShowControls(true);
      if (hideControlsTimeoutRef.current) {
        clearTimeout(hideControlsTimeoutRef.current);
        hideControlsTimeoutRef.current = null;
      }
      if (!isTouchDevice) {
        hideControlsTimeoutRef.current = setTimeout(() => setShowControls(false), 3000);
      }
    };

    // تحسين: معالجة اللمس بمزيد من الدقة
    const handleTouchStart = (e) => {
      if (!isTouchDevice) return;

      const currentTime = Date.now();
      const tapLength = currentTime - lastTapTime;
      const touch = e.touches[0];

      // حفظ موقع اللمس الأولي للكشف عن السحب
      touchStartXRef.current = touch.clientX;
      touchStartYRef.current = touch.clientY;
      touchStartTimeRef.current = currentTime;

      const containerWidth =
        videoRef.current?.parentElement?.offsetWidth || window.innerWidth;
      const tapX = touch ? touch.clientX : 0;

      // تحسين: زيادة عتبة اكتشاف النقر المزدوج لتجنب الأخطاء
      if (tapLength < 350 && tapLength > 50) {
        // cancel any pending long-press
        if (longPressTimerRef.current) {
          clearTimeout(longPressTimerRef.current);
          longPressTimerRef.current = null;
        }

        // تحسين: التأكد من أن النقرة الثانية في نفس المنطقة تقريباً
        const lastTouchInfo = lastTouchInfoRef.current;
        const isSimilarX = Math.abs(tapX - (lastTouchInfo.tapX || 0)) < 50;

        if (isSimilarX) {
          // perform double-tap seek
          if (tapX > containerWidth / 2) {
            // forward 10s
            if (videoRef.current) {
              videoRef.current.currentTime = Math.min(
                videoRef.current.duration || 0,
                videoRef.current.currentTime + 10,
              );
              setCurrentTime(videoRef.current.currentTime);
              showSeekFeedback("forward");
            }
            doubleTapHandledRef.current = true;
          } else {
            // back 10s
            if (videoRef.current) {
              videoRef.current.currentTime = Math.max(
                0,
                videoRef.current.currentTime - 10,
              );
              setCurrentTime(videoRef.current.currentTime);
              showSeekFeedback("backward");
            }
            doubleTapHandledRef.current = true;
          }
          setLastTapTime(0);
          return;
        }
      }

      // single tap: show controls and start long-press timer
      setLastTapTime(currentTime);
      setShowTouchControls(true);
      setShowControls(true);

      // حفظ معلومات اللمس الأخير (مخزن منفصل عن lastRenderedTimeRef)
      lastTouchInfoRef.current = {
        ...lastTouchInfoRef.current,
        tapX,
        tapTime: currentTime,
      };

      // تحسين: زيادة وقت الضغط المطول لتجنب التشويش
      if (longPressTimerRef.current) {
        clearTimeout(longPressTimerRef.current);
        longPressTimerRef.current = null;
      }

      // reset/extend hide timeout while interacting (longer on touch)
      if (touchHideTimeoutRef.current) clearTimeout(touchHideTimeoutRef.current);
      touchHideTimeoutRef.current = setTimeout(() => {
        if (!longPressActiveRef.current && !qualityMenuOpen && !speedMenuOpen) {
          setShowTouchControls(false);
          setShowControls(false);
        }
      }, 5500);

      if (tapTimeout.current) clearTimeout(tapTimeout.current);
      tapTimeout.current = setTimeout(() => {
        setLastTapTime(0);
        doubleTapHandledRef.current = false;
      }, 500); // slightly increased double-tap window for touch
    };

    const handleTouchMove = (e) => {
      if (!isTouchDevice || !touchStartXRef.current) return;

      const touch = e.touches[0];
      const deltaX = Math.abs(touch.clientX - touchStartXRef.current);
      const deltaY = Math.abs(touch.clientY - touchStartYRef.current);

      // إذا كان المستخدم يسحب أفقيًا بشكل ملحوظ، ألغِ الضغط المطول
      if (deltaX > 10 || deltaY > 10) {
        if (longPressTimerRef.current) {
          clearTimeout(longPressTimerRef.current);
          longPressTimerRef.current = null;
        }
      }
    };

    const handleTouchEnd = (e) => {
      // clear long-press timer
      if (longPressTimerRef.current) {
        clearTimeout(longPressTimerRef.current);
        longPressTimerRef.current = null;
      }

      // long-press speed-change removed — continue normal touch end behavior

      // schedule hide after interaction (longer on touch)
      if (touchHideTimeoutRef.current) clearTimeout(touchHideTimeoutRef.current);
      touchHideTimeoutRef.current = setTimeout(() => {
        if (!qualityMenuOpen && !speedMenuOpen) {
          setShowTouchControls(false);
          setShowControls(false);
        }
      }, 5000);

      // تحسين: زيادة عتبة وقت اللمس لتجنب التشويش
      const touchDuration = Date.now() - (touchStartTimeRef.current || 0);
      const touch = e.changedTouches[0];
      const endX = touch ? touch.clientX : 0;
      const endY = touch ? touch.clientY : 0;
      const deltaX = Math.abs(endX - touchStartXRef.current);
      const deltaY = Math.abs(endY - touchStartYRef.current);

      // Determine if this was a simple tap (short and minimal movement)
      const isSimpleTap =
        touchDuration < 500 && deltaX < 12 && deltaY < 12 && !progressDragRef.current;

      // If it's a simple tap and not part of a double-tap handling, toggle controls
      if (isSimpleTap && !doubleTapHandledRef.current && !longPressActiveRef.current) {
        setShowTouchControls((s) => {
          const next = !s;
          setShowControls(next);
          if (next) {
            if (touchHideTimeoutRef.current) clearTimeout(touchHideTimeoutRef.current);
            touchHideTimeoutRef.current = setTimeout(() => {
              if (!qualityMenuOpen && !speedMenuOpen) {
                setShowTouchControls(false);
                setShowControls(false);
              }
            }, 5000);
          } else {
            if (touchHideTimeoutRef.current) {
              clearTimeout(touchHideTimeoutRef.current);
              touchHideTimeoutRef.current = null;
            }
            clearHideControls();
          }
          return next;
        });
      }

      // Reset interaction flags
      doubleTapHandledRef.current = false;
      touchStartXRef.current = 0;
      touchStartYRef.current = 0;
    };

    const container = videoRef.current?.parentElement;
    if (container) {
      // ensure touch-action is set to allow immediate taps/manipulation
      try {
        if (isTouchDevice) container.style.touchAction = "manipulation";
      } catch (e) {}
      container.addEventListener("click", handleContainerClick);
      if (isTouchDevice) {
        container.addEventListener("touchstart", handleTouchStart, {
          passive: false,
        });
        container.addEventListener("touchmove", handleTouchMove, {
          passive: true,
        });
        container.addEventListener("touchend", handleTouchEnd);
      }
    }

    return () => {
      if (hlsRef.current) {
        try {
          hlsRef.current.destroy();
        } catch (e) { }
        hlsRef.current = null;
      }
      if (videoRef.current) {
        videoRef.current.pause();
        videoRef.current.removeAttribute("src");
        try {
          videoRef.current.load();
        } catch (e) { }
      }
      clearInterval(saveInt);
      try {
        cancelAnimationFrame(rafId);
      } catch (e) { }
      if (hideControlsTimeoutRef.current) {
        clearTimeout(hideControlsTimeoutRef.current);
        hideControlsTimeoutRef.current = null;
      }
      if (touchHideTimeoutRef.current) {
        clearTimeout(touchHideTimeoutRef.current);
        touchHideTimeoutRef.current = null;
      }
      if (longPressTimerRef.current) {
        clearTimeout(longPressTimerRef.current);
        longPressTimerRef.current = null;
      }
      if (touchControlsTimeout.current)
        clearTimeout(touchControlsTimeout.current);
      if (tapTimeout.current) clearTimeout(tapTimeout.current);
      if (container) {
        container.removeEventListener("click", handleContainerClick);
        try {
          container.removeEventListener("touchstart", handleTouchStart);
        } catch (e) { }
        try {
          container.removeEventListener("touchmove", handleTouchMove);
        } catch (e) { }
        try {
          container.removeEventListener("touchend", handleTouchEnd);
        } catch (e) { }
        try {
          if (isTouchDevice) container.style.touchAction = "";
        } catch (e) {}
      }
      videoRef.current?.removeEventListener("timeupdate", updateTime);
    };
  }, [video, currentQuality, shouldInit, isTouchDevice]);

  // Ensure showControls state always schedules/clears hide timeout consistently
  useEffect(() => {
    try {
      if (showControls) {
        // Choose longer delay for touch devices
        scheduleHideControls(isTouchDevice ? 5000 : 3000);
      } else {
        clearHideControls();
      }
    } catch (e) {}
    return () => {
      // no-op cleanup here; timeouts are cleared by helpers
    };
  }, [showControls, isTouchDevice, qualityMenuOpen, speedMenuOpen]);

  // sync volume and rate when changed
  useEffect(() => {
    try {
      if (videoRef.current) videoRef.current.volume = volume;
      localStorage.setItem("video-volume", String(volume));
    } catch (e) { }
  }, [volume]);

  useEffect(() => {
    try {
      if (videoRef.current) videoRef.current.playbackRate = playbackRate;
      localStorage.setItem("video-rate", String(playbackRate));
    } catch (e) { }
  }, [playbackRate]);

  // keyboard shortcuts and Media Session
  useEffect(() => {
    // Keyboard shortcuts: skip adding key handlers on touch devices
    const onKey = (e) => {
      if (isTouchDevice) return; // disable on touch devices
      if (!videoRef.current) return;
      const v = videoRef.current;
      if (e.code === "Space") {
        e.preventDefault();
        if (v.paused) {
          safePlay();
          try {
            showActionFeedback(Icons.PlayArrow, "تشغيل");
          } catch (e) { }
        } else {
          v.pause();
          try {
            showActionFeedback(Icons.PauseCircle, "إيقاف");
          } catch (e) { }
        }
        setShowControls(true);
        setTimeout(() => {
          if (!v.paused && !isTouchDevice) setShowControls(false);
        }, 3000);
      } else if (e.code === "ArrowRight") {
        v.currentTime = Math.min(v.duration || 0, v.currentTime + 5);
        setCurrentTime(v.currentTime);
        setShowControls(true);
        try {
          showActionFeedback(Icons.Forward10, "+5s");
        } catch (e) { }
      } else if (e.code === "ArrowLeft") {
        v.currentTime = Math.max(0, v.currentTime - 5);
        setCurrentTime(v.currentTime);
        setShowControls(true);
        try {
          showActionFeedback(Icons.Replay10, "-5s");
        } catch (e) { }
      } else if (e.code === "ArrowUp") {
        e.preventDefault();
        const nv = Math.min(1, Math.round((v.volume + 0.05) * 100) / 100);
        v.volume = nv;
        setVolume(nv);
        try {
          showActionFeedback(
            Icons.VolumeHigh,
            `الصوت ${Math.round(nv * 100)}%`,
          );
        } catch (e) { }
      } else if (e.code === "ArrowDown") {
        e.preventDefault();
        const nv = Math.max(0, Math.round((v.volume - 0.05) * 100) / 100);
        v.volume = nv;
        setVolume(nv);
        try {
          showActionFeedback(
            nv === 0 ? Icons.VolumeOff : Icons.VolumeLow,
            `الصوت ${Math.round(nv * 100)}%`,
          );
        } catch (e) { }
      } else if (e.code === "KeyF") {
        toggleFullscreen();
      } else if (e.code === "KeyM") {
        try {
          // remember previous non-zero volume
          if (v.volume > 0) {
            prevVolumeRef.current = v.volume;
            setVolume(0);
            v.volume = 0;
            try {
              showActionFeedback(Icons.VolumeOff, "كتم");
            } catch (e) { }
          } else {
            const restore =
              prevVolumeRef.current != null && prevVolumeRef.current > 0
                ? prevVolumeRef.current
                : 1;
            setVolume(restore);
            v.volume = restore;
            try {
              showActionFeedback(
                Icons.VolumeHigh,
                `الصوت ${Math.round(restore * 100)}%`,
              );
            } catch (e) { }
          }
        } catch (err) {
          setVolume(v.volume === 0 ? 1 : 0);
        }
      } else if (e.key === ">" || e.key === ".") {
        // Increase rate by 0.05 (Shift+.) emits '>' on many layouts
        increaseRate();
      } else if (e.key === "<" || e.key === ",") {
        // Decrease rate by 0.05 (Shift+, emits '<')
        decreaseRate();
      } else if (e.code === "Escape" && document.fullscreenElement) {
        toggleFullscreen();
      }
    };
    if (!isTouchDevice) window.addEventListener("keydown", onKey);

    // Fullscreen change listener (needed on all devices)
    const handleFullscreenChange = () => {
      const isFs = !!document.fullscreenElement;
      setIsFullscreen(isFs);
      // ensure controls are visible in fullscreen
      setShowControls(true);
      setShowTouchControls(true);
      clearHideControls();
      if (!isFs) {
        setTimeout(updateVideoSizing, 100);
        // schedule hide after exiting fullscreen
        scheduleHideControls(3000);
      }
    };
    document.addEventListener("fullscreenchange", handleFullscreenChange);

    // Media Session (still fine on touch devices)
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
            videoRef.current.currentTime = Math.max(
              0,
              videoRef.current.currentTime - skip,
            );
            setCurrentTime(videoRef.current.currentTime);
          }
        });
        navigator.mediaSession.setActionHandler("seekforward", (details) => {
          const skip = (details && details.seekOffset) || 10;
          if (videoRef.current) {
            videoRef.current.currentTime = Math.min(
              videoRef.current.duration || 0,
              videoRef.current.currentTime + skip,
            );
            setCurrentTime(videoRef.current.currentTime);
          }
        });
      } catch (e) { }
    }
    return () => {
      if (!isTouchDevice) window.removeEventListener("keydown", onKey);
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
    };
  }, [video, isTouchDevice]);

  // keep `isPlaying` in sync with the media element
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    const onPlay = () => setIsPlaying(true);
    const onPause = () => setIsPlaying(false);
    v.addEventListener("play", onPlay);
    v.addEventListener("pause", onPause);
    return () => {
      try {
        v.removeEventListener("play", onPlay);
      } catch (e) { }
      try {
        v.removeEventListener("pause", onPause);
      } catch (e) { }
    };
  }, [videoRef.current]);

  // close menus on outside click or Escape
  useEffect(() => {
    const onDocClick = (e) => {
      if (
        qualityMenuOpen &&
        qualityRef.current &&
        !qualityRef.current.contains(e.target)
      ) {
        setQualityMenuOpen(false);
      }
      if (
        speedMenuOpen &&
        speedRef.current &&
        !speedRef.current.contains(e.target)
      ) {
        setSpeedMenuOpen(false);
      }
      if (
        settingsMenuOpen &&
        settingsRef.current &&
        !settingsRef.current.contains(e.target)
      ) {
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

  // keep controls visible while menus are open on touch devices
  useEffect(() => {
    if (isTouchDevice && (qualityMenuOpen || speedMenuOpen)) {
      if (touchHideTimeoutRef.current) {
        clearTimeout(touchHideTimeoutRef.current);
        touchHideTimeoutRef.current = null;
      }
      setShowControls(true);
      setShowTouchControls(true);
    } else if (isTouchDevice) {
      // start a short hide timeout when menus close
      if (touchHideTimeoutRef.current)
        clearTimeout(touchHideTimeoutRef.current);
      touchHideTimeoutRef.current = setTimeout(() => {
        setShowTouchControls(false);
        setShowControls(false);
      }, 1500);
    }
    return () => {
      if (touchHideTimeoutRef.current) {
        clearTimeout(touchHideTimeoutRef.current);
        touchHideTimeoutRef.current = null;
      }
    };
  }, [qualityMenuOpen, speedMenuOpen, isTouchDevice]);

  const handleQualityChange = (q) => setCurrentQuality(q);

  // persist user's explicit quality choice per-video so future opens respect it
  const handleQualityChangePersist = (q) => {
    try {
      localStorage.setItem(`video-default-quality-${video._id}`, String(q));
    } catch (e) { }
    setCurrentQuality(q);
  };

  // Apply a chosen quality to hls (lock level) and update video element sizing
  const applyQualityToHls = (hls, quality) => {
    if (!hls || !hls.levels || !quality) return;
    const target = RES_MAP[String(quality)];
    if (!target) return;
    // find level index that matches height or closest height
    let bestIdx = -1;
    let bestDiff = Infinity;
    hls.levels.forEach((lvl, idx) => {
      const h = lvl?.height || 0;
      const diff = Math.abs(h - target.h);
      if (diff < bestDiff) {
        bestDiff = diff;
        bestIdx = idx;
      }
    });
    if (bestIdx >= 0) {
      try {
        // lock to this level
        hls.currentLevel = bestIdx;
      } catch (e) { }
    }
  };

  // Update DOM sizing for video element based on selected quality and fullscreen state
  const updateVideoSizing = () => {
    try {
      const v = videoRef.current;
      if (!v) return;
      const q = String(currentQuality || "");
      const map = RES_MAP[q];
      // Keep video element sizing stable to prevent layout reflows which may cause stutter.
      // The outer container uses aspect-video (16:9). We simply make the <video>
      // fill that container while preserving aspect ratio via object-fit.
      v.style.width = "100%";
      v.style.height = "100%";
      // use cover in fullscreen for immersive feeling, contain otherwise
      v.style.objectFit = isFullscreen ? "cover" : "contain";
      v.style.maxWidth = "100%";
      v.style.maxHeight = "100%";
      v.style.display = "block";
    } catch (e) {
      // suppressed logging in production build
    }
  };

  const toggleFullscreen = () => {
    try {
      if (!videoRef.current) return;
      // Use the outer wrapper (parent of the containerRef) so sibling
      // controls (progress bar / bottom controls) are included in
      // the fullscreen element and remain visible.
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

        // تحسين الأداء في وضع ملء الشاشة
        if (hlsRef.current) {
          hlsRef.current.config.maxBufferLength = 30;
          hlsRef.current.config.maxMaxBufferLength = 60;
        }
      } else {
        if (document.exitFullscreen) {
          document.exitFullscreen();
        } else if (document.webkitExitFullscreen) {
          document.webkitExitFullscreen();
        } else if (document.msExitFullscreen) {
          document.msExitFullscreen();
        }
        setIsFullscreen(false);

        // reset buffer settings for normal mode
        if (hlsRef.current) {
          hlsRef.current.config.maxBufferLength = 30;
          hlsRef.current.config.maxMaxBufferLength = 60;
        }
      }

      // تحديث أبعاد الفيديو بعد تغيير وضع الشاشة
      setTimeout(updateVideoSizing, 100);
    } catch (e) { }
  };

  const togglePlayPause = useCallback(() => {
    try {
      if (!videoRef.current) return;
      if (videoRef.current.paused) {
        safePlay();
        setIsPlaying(true);
      } else {
        videoRef.current.pause();
        setIsPlaying(false);
      }
      setShowControls(true);
      setShowTouchControls(true);
      scheduleHideControls(isTouchDevice ? 5000 : 3000);
    } catch (e) { }
  }, [isTouchDevice]);

  // Safe play wrapper to avoid unhandled promise rejections (AbortError)
  const safePlay = useCallback(() => {
    try {
      const p =
        videoRef.current && videoRef.current.play && videoRef.current.play();
      if (p && typeof p.then === "function") {
        p.then(() => setIsPlaying(true)).catch((err) => {
          if (err && err.name === "AbortError") return;
        });
      }
    } catch (e) {
      // swallow synchronous errors
    }
  }, []);

  // Retry playback without full page reload: destroy hls, clear src and re-init
  const retryPlayback = useCallback(() => {
    try {
      setError(null);
      setLoading(true);
      // destroy existing hls if any
      if (hlsRef.current) {
        try {
          hlsRef.current.destroy();
        } catch (e) { }
        hlsRef.current = null;
      }
      // clear video src and attempt to reload
      try {
        if (videoRef.current) {
          videoRef.current.pause();
          videoRef.current.removeAttribute("src");
          try {
            videoRef.current.load();
          } catch (e) { }
        }
      } catch (e) { }

      // re-trigger init effect by toggling shouldInit briefly
      setShouldInit(false);
      setTimeout(() => {
        setShouldInit(true);
      }, 80);
    } catch (e) { }
  }, []);

  // react to quality or fullscreen changes to update sizing and hls level
  useEffect(() => {
    // update element sizing
    updateVideoSizing();
    // if hls present, apply quality lock
    try {
      const hls = hlsRef.current;
      if (hls && currentQuality) applyQualityToHls(hls, currentQuality);
      try {
        if (hls && currentQuality) hls.autoLevelEnabled = false;
      } catch (e) { }
    } catch (e) { }
  }, [currentQuality, isFullscreen]);

  // تحديث أبعاد الفيديو عند تغيير حجم النافذة
  useEffect(() => {
    const handleResize = () => {
      updateVideoSizing();
    };

    window.addEventListener("resize", handleResize);
    return () => {
      window.removeEventListener("resize", handleResize);
    };
  }, []);

  const formatTime = (seconds) => {
    if (seconds == null || isNaN(seconds)) return "0:00";
    const sec = Math.floor(seconds);
    const hrs = Math.floor(sec / 3600);
    const mins = Math.floor((sec % 3600) / 60);
    const secs = sec % 60;
    if (hrs > 0) {
      return `${hrs}:${mins < 10 ? "0" : ""}${mins}:${secs < 10 ? "0" : ""}${secs}`;
    }
    return `${mins}:${secs < 10 ? "0" : ""}${secs}`;
  };

  const progressPct = duration ? (currentTime / duration) * 100 : 0;

  // determine if progress bar should be RTL-aware
  const isProgressRtl = () => {
    try {
      const el = progressRef.current;
      if (!el) return document && document.dir === "rtl";
      return getComputedStyle(el).direction === "rtl";
    } catch (e) {
      return document && document.dir === "rtl";
    }
  };

  // تحسين: معالجة السحب على شريط التقدم للشاشات اللمسية
  const handleSeek = (e) => {
    if (!videoRef.current || !duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const rtl = isProgressRtl();
    const x = e.clientX - rect.left;
    let percentage = x / rect.width;
    if (rtl) percentage = 1 - percentage;
    const newTime = Math.max(0, Math.min(1, percentage)) * duration;
    videoRef.current.currentTime = newTime;
    setCurrentTime(newTime);
  };

  const handleTouchSeekStart = (e) => {
    if (!videoRef.current || !duration) return;
    e.preventDefault();
    progressDragRef.current = true;
    const touch = e.touches[0];
    const rect = e.currentTarget.getBoundingClientRect();
    progressDragStartXRef.current = touch.clientX;
    progressDragStartTimeRef.current = videoRef.current.currentTime;

    // إظهار عناصر التحكم عند البدء بالسحب
    setShowControls(true);
    setShowTouchControls(true);
  };

  const handleTouchSeekMove = (e) => {
    if (!progressDragRef.current || !videoRef.current || !duration) return;
    e.preventDefault();

    const touch = e.touches[0];
    const rect = e.currentTarget.getBoundingClientRect();
    const rtl = isProgressRtl();

    let x = touch.clientX - rect.left;
    x = Math.max(0, Math.min(rect.width, x));

    let percentage = x / rect.width;
    if (rtl) percentage = 1 - percentage;

    const newTime = Math.max(0, Math.min(1, percentage)) * duration;
    videoRef.current.currentTime = newTime;
    setCurrentTime(newTime);
  };

  const handleTouchSeekEnd = (e) => {
    progressDragRef.current = false;
    progressDragStartXRef.current = 0;
    progressDragStartTimeRef.current = 0;

    // إخفاء عناصر التحكم بعد فترة
    if (touchHideTimeoutRef.current) clearTimeout(touchHideTimeoutRef.current);
      touchHideTimeoutRef.current = setTimeout(() => {
        setShowTouchControls(false);
        setShowControls(false);
      }, 2000);
  };

  // Pointer (mouse) drag support for desktop: unify with touch handlers
  const handlePointerSeekStart = (e) => {
    if (!videoRef.current || !duration) return;
    e.preventDefault();
    e.stopPropagation();
    progressDragRef.current = true;
    const rect = progressRef.current?.getBoundingClientRect();
    progressDragStartXRef.current = e.clientX || 0;
    progressDragStartTimeRef.current = videoRef.current.currentTime || 0;
    // attach global listeners to track pointer move/up
    window.addEventListener("pointermove", handlePointerSeekMove);
    window.addEventListener("pointerup", handlePointerSeekEnd);
  };

  const handlePointerSeekMove = (e) => {
    if (
      !progressDragRef.current ||
      !videoRef.current ||
      !duration ||
      !progressRef.current
    )
      return;
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
  };

  const handlePointerSeekEnd = (e) => {
    progressDragRef.current = false;
    progressDragStartXRef.current = 0;
    progressDragStartTimeRef.current = 0;
    window.removeEventListener("pointermove", handlePointerSeekMove);
    window.removeEventListener("pointerup", handlePointerSeekEnd);
    // hide controls after brief delay
    if (touchHideTimeoutRef.current) clearTimeout(touchHideTimeoutRef.current);
    touchHideTimeoutRef.current = setTimeout(() => {
      setShowTouchControls(false);
      setShowControls(false);
    }, 1000);
  };

  const rateStep = 0.05;
  const increaseRate = () =>
    setPlaybackRate((r) => Math.min(3, Math.round((r + rateStep) * 100) / 100));
  const decreaseRate = () =>
    setPlaybackRate((r) =>
      Math.max(0.25, Math.round((r - rateStep) * 100) / 100),
    );

  const adjustRate = (delta) => {
    try {
      const v =
        Math.round(Math.max(0.25, Math.min(3, playbackRate + delta)) * 100) /
        100;
      setPlaybackRate(v);
      showRateFeedback(v);
    } catch (e) { }
  };

  // pulse animation when rate changes
  const [ratePulse, setRatePulse] = useState(false);
  useEffect(() => {
    setRatePulse(true);
    const t = setTimeout(() => setRatePulse(false), 450);
    return () => clearTimeout(t);
  }, [playbackRate]);

  // تحسين: إضافة ردود فعل مرئية لللمس
  const [seekFeedback, setSeekFeedback] = useState({
    visible: false,
    type: "",
    time: "",
  });
  const [rateFeedback, setRateFeedback] = useState({ visible: false, rate: 1 });

  const [actionFeedback, setActionFeedback] = useState({
    visible: false,
    icon: null,
    text: "",
  });

  const [volumeFeedback, setVolumeFeedback] = useState({ visible: false, percent: 0 });

  const showVolumeFeedback = (pct, timeout = 900) => {
    try {
      setVolumeFeedback({ visible: true, percent: pct });
      setTimeout(() => setVolumeFeedback({ visible: false, percent: 0 }), timeout);
    } catch (e) {}
  };

  const showActionFeedback = (icon, text, timeout = 800) => {
    setActionFeedback({ visible: true, icon, text });
    setTimeout(
      () => setActionFeedback({ visible: false, icon: null, text: "" }),
      timeout,
    );
  };

  const [hoverProgress, setHoverProgress] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(null); // percent 0-100 or null for indeterminate

  const showSeekFeedback = (type) => {
    const time = type === "forward" ? "+10s" : "-10s";
    setSeekFeedback({ visible: true, type, time });
    setTimeout(() => {
      setSeekFeedback({ visible: false, type: "", time: "" });
    }, 800);
  };

  const showRateFeedback = (rate) => {
    setRateFeedback({ visible: true, rate });
    setTimeout(() => {
      setRateFeedback({ visible: false, rate: 1 });
    }, 1000);
  };

  // auth
  const { user, isLoggedIn } = useAuth();

  // download state removed: simple browser-managed download (no floating UI)

  // أيقونات SVG
  const Icons = {
    Play: () => (
      <svg
        className="w-6 h-6"
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path d="M8 5V19L19 12L8 5Z" fill="currentColor" />
      </svg>
    ),
    Replay10: () => (
      <svg
        className="w-5 h-5 sm:w-6 sm:h-6"
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <circle
          cx="12"
          cy="12"
          r="9"
          stroke="currentColor"
          strokeWidth="1.4"
          fill="none"
        />
        <path
          d="M8.5 9.5L5.5 12L8.5 14.5"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
        <path
          d="M9.5 7.5A6 6 0 0 1 17 12"
          stroke="currentColor"
          strokeWidth="1.4"
          strokeLinecap="round"
          fill="none"
        />
      </svg>
    ),
    Pause: () => (
      <svg
        className="w-6 h-6"
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <rect x="6" y="5" width="4" height="14" fill="currentColor" />
        <rect x="14" y="5" width="4" height="14" fill="currentColor" />
      </svg>
    ),
    Forward10: () => (
      <svg
        className="w-5 h-5 sm:w-6 sm:h-6"
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <circle
          cx="12"
          cy="12"
          r="9"
          stroke="currentColor"
          strokeWidth="1.4"
          fill="none"
        />
        <path
          d="M15.5 9.5L18.5 12L15.5 14.5"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
        <path
          d="M14.5 7.5A6 6 0 0 0 7 12"
          stroke="currentColor"
          strokeWidth="1.4"
          strokeLinecap="round"
          fill="none"
        />
      </svg>
    ),
    Settings: () => (
      <svg
        className="w-6 h-6"
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          d="M12 15.5C13.93 15.5 15.5 13.93 15.5 12C15.5 10.07 13.93 8.5 12 8.5C10.07 8.5 8.5 10.07 8.5 12C8.5 13.93 10.07 15.5 12 15.5Z"
          fill="currentColor"
        />
        <path
          d="M19.43 12.97C19.47 12.65 19.5 12.33 19.5 12C19.5 11.67 19.47 11.34 19.43 11.01L21.54 9.37C21.73 9.22 21.78 8.95 21.66 8.73L19.66 5.27C19.54 5.05 19.27 4.96 19.05 5.05L16.56 6.05C16.04 5.66 15.5 5.32 14.87 5.07L14.5 2.42C14.46 2.18 14.25 2 14 2H10C9.75 2 9.54 2.18 9.5 2.42L9.13 5.07C8.5 5.32 7.96 5.66 7.44 6.05L4.95 5.05C4.73 4.96 4.46 5.05 4.34 5.27L2.34 8.73C2.22 8.95 2.27 9.22 2.46 9.37L4.57 11.01C4.53 11.34 4.5 11.67 4.5 12C4.5 12.33 4.53 12.65 4.57 12.97L2.46 14.63C2.27 14.78 2.22 15.05 2.34 15.27L4.34 18.73C4.46 18.95 4.73 19.03 4.95 18.95L7.44 17.94C7.96 18.34 8.5 18.68 9.13 18.93L9.5 21.58C9.54 21.82 9.75 22 10 22H14C14.25 22 14.46 21.82 14.5 21.58L14.87 18.93C15.5 18.68 16.04 18.34 16.56 17.94L19.05 18.95C19.27 19.03 19.54 18.95 19.66 18.73L21.66 15.27C21.78 15.05 21.73 14.78 21.54 14.63L19.43 12.97Z"
          fill="currentColor"
        />
      </svg>
    ),
    VolumeOff: () => (
      <svg
        className="w-6 h-6"
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          d="M16.5 12C16.5 10.23 15.48 8.71 14 7.97V10.18L16.45 12.63C16.48 12.43 16.5 12.22 16.5 12Z"
          fill="currentColor"
        />
        <path
          d="M19 12C19 12.94 18.8 13.82 18.46 14.64L19.97 16.15C20.62 14.91 21 13.5 21 12C21 7.72 18.01 4.14 14 3.23V5.29C16.89 6.15 19 8.83 19 12Z"
          fill="currentColor"
        />
        <path
          d="M4.27 3L3 4.27L7.73 9H3V15H7L12 20V13.27L16.25 17.52C15.58 18.04 14.83 18.46 14 18.7V20.77C15.38 20.45 16.63 19.82 17.68 18.93L19.73 21L21 19.73L12 10.73L4.27 3Z"
          fill="currentColor"
        />
      </svg>
    ),
    VolumeLow: () => (
      <svg
        className="w-6 h-6"
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path d="M7 9V15H11L16 20V4L11 9H7Z" fill="currentColor" />
      </svg>
    ),
    VolumeHigh: () => (
      <svg
        className="w-6 h-6"
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path d="M3 9V15H7L12 20V4L7 9H3Z" fill="currentColor" />
        <path
          d="M16.5 12C16.5 10.23 15.48 8.71 14 7.97V16.02C15.48 15.29 16.5 13.77 16.5 12Z"
          fill="currentColor"
        />
        <path
          d="M14 3.23V5.29C16.89 6.15 19 8.83 19 12C19 15.17 16.89 17.85 14 18.71V20.77C18.01 19.86 21 16.28 21 12C21 7.72 18.01 4.14 14 3.23Z"
          fill="currentColor"
        />
      </svg>
    ),
    Fullscreen: () => (
      <svg
        className="w-6 h-6"
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path d="M7 14H5V19H10V17H7V14Z" fill="currentColor" />
        <path d="M5 10H7V7H10V5H5V10Z" fill="currentColor" />
        <path d="M17 17H14V19H19V14H17V17Z" fill="currentColor" />
        <path d="M14 5V7H17V10H19V5H14Z" fill="currentColor" />
      </svg>
    ),
    FullscreenExit: () => (
      <svg
        className="w-6 h-6"
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path d="M5 16H8V19H10V14H5V16Z" fill="currentColor" />
        <path d="M8 8H5V10H10V5H8V8Z" fill="currentColor" />
        <path d="M14 19H16V16H19V14H14V19Z" fill="currentColor" />
        <path d="M16 8V5H14V10H19V8H16Z" fill="currentColor" />
      </svg>
    ),
    PictureInPicture: () => (
      <svg
        className="w-6 h-6"
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path d="M19 7H11V11H19V7Z" fill="currentColor" />
        <path
          d="M21 3H3C1.9 3 1 3.9 1 5V19C1 20.1 1.9 21 3 21H21C22.1 21 23 20.1 23 19V5C23 3.9 22.1 3 21 3ZM21 19H3V5H21V19Z"
          fill="currentColor"
        />
      </svg>
    ),
    Quality: () => (
      <svg
        className="w-6 h-6"
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          d="M19 4H5C3.89 4 3 4.9 3 6V18C3 19.1 3.89 20 5 20H19C20.1 20 21 19.1 21 18V6C21 4.9 20.11 4 19 4ZM19 18H5V6H19V18Z"
          fill="currentColor"
        />
        <path d="M7.5 13.5H9.5V15H7.5V13.5Z" fill="currentColor" />
        <path d="M11.5 13.5H13.5V15H11.5V13.5Z" fill="currentColor" />
        <path d="M15.5 13.5H17.5V15H15.5V13.5Z" fill="currentColor" />
      </svg>
    ),
    Speed: () => (
      <svg
        className="w-6 h-6"
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          d="M20.38 8.57L13.92 2.2C13.72 2.07 13.56 2 13.3 2H6.5C5.67 2 5 2.67 5 3.5V20.5C5 21.33 5.67 22 6.5 22H17.5C18.33 22 19 21.33 19 20.5V9.3C19 9.04 18.93 8.78 18.7 8.58L20.38 8.57Z"
          fill="currentColor"
        />
        <path
          d="M12 17.5C10.07 17.5 8.5 15.93 8.5 14C8.5 12.07 10.07 10.5 12 10.5C13.93 10.5 15.5 12.07 15.5 14C15.5 15.93 13.93 17.5 12 17.5Z"
          fill="currentColor"
        />
      </svg>
    ),
    ChevronDown: () => (
      <svg
        className="w-5 h-5"
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          d="M7.41 8.59L12 13.17L16.59 8.59L18 10L12 16L6 10L7.41 8.59Z"
          fill="currentColor"
        />
      </svg>
    ),
    ChevronUp: () => (
      <svg
        className="w-5 h-5"
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          d="M7.41 15.41L12 10.83L16.59 15.41L18 14L12 8L6 14L7.41 15.41Z"
          fill="currentColor"
        />
      </svg>
    ),
    ClosedCaption: () => (
      <svg
        className="w-6 h-6"
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          d="M19 4H5C3.89 4 3 4.9 3 6V18C3 19.1 3.89 20 5 20H19C20.1 20 21 19.1 21 18V6C21 4.9 20.11 4 19 4ZM19 18H5V6H19V18Z"
          fill="currentColor"
        />
        <path
          d="M7 15H10C10.55 15 11 14.55 11 14V13H9.5V13.5H7.5V10.5H9.5V11H11V10C11 9.45 10.55 9 10 9H7C6.45 9 6 9.45 6 10V14C6 14.55 6.45 15 7 15Z"
          fill="currentColor"
        />
        <path
          d="M14 15H17C17.55 15 18 14.55 18 14V13H16.5V13.5H14.5V10.5H16.5V11H18V10C18 9.45 17.55 9 17 9H14C13.45 9 13 9.45 13 10V14C13 14.55 13.45 15 14 15Z"
          fill="currentColor"
        />
      </svg>
    ),
    MoreVert: () => (
      <svg
        className="w-6 h-6"
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          d="M12 8C13.1 8 14 7.1 14 6C14 4.9 13.1 4 12 4C10.9 4 10 4.9 10 6C10 7.1 10.9 8 12 8ZM12 10C10.9 10 10 10.9 10 12C10 13.1 10.9 14 12 14C13.1 14 14 13.1 14 12C14 10.9 13.1 10 12 10ZM12 16C10.9 16 10 16.9 10 18C10 19.1 10.9 20 12 20C13.1 20 14 19.1 14 18C14 16.9 13.1 16 12 16Z"
          fill="currentColor"
        />
      </svg>
    ),
    PlayArrow: () => (
      <svg
        className="w-8 h-8 sm:w-10 sm:h-10"
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path d="M8 5V19L19 12L8 5Z" fill="currentColor" />
      </svg>
    ),
    PauseCircle: () => (
      <svg
        className="w-8 h-8 sm:w-10 sm:h-10"
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          d="M9 16H11V8H9V16ZM13 8V16H15V8H13ZM12 2C6.48 2 2 6.48 2 12C2 17.52 6.48 22 12 22C17.52 22 22 17.52 22 12C22 6.48 17.52 2 12 2ZM12 20C7.59 20 4 16.41 4 12C4 7.59 7.59 4 12 4C16.41 4 20 7.59 20 12C20 16.41 16.41 20 12 20Z"
          fill="currentColor"
        />
      </svg>
    ),
  };

  return (
    <div className="space-y-2 relative">
      <div
        className={`relative w-full bg-gradient-to-br from-gray-900 to-black rounded-xl overflow-hidden 
          ${isFullscreen ? "fixed inset-0 z-50 rounded-none" : "aspect-video max-h-[70vh] shadow-lg"}`}
        ref={containerRef}
        onMouseLeave={() => {
          if (!isTouchDevice) {
            if (hideControlsTimeoutRef.current) clearTimeout(hideControlsTimeoutRef.current);
            hideControlsTimeoutRef.current = setTimeout(() => setShowControls(false), 3000);
          }
        }}
        onMouseMove={() => {
          try {
            setShowControls(true);
            setShowTouchControls(true);
            scheduleHideControls(3000);
          } catch (e) { }
        }}
        onClick={(e) => {
          try {
            if (isTouchDevice) return; // ignore React click on touch devices (handled by touch listeners)
            // If click was on a control element, ignore here (they stopPropagation anyway).
            const el = e.target;
            if (el && el.closest && el.closest('button, input, select, textarea, [role="slider"], .pointer-events-auto')) return;
            // Toggle controls visibility (do not toggle playback)
            setShowControls((s) => {
              const next = !s;
              if (next) {
                scheduleHideControls(3000);
                setShowTouchControls(true);
              } else {
                clearHideControls();
                setShowTouchControls(false);
              }
              return next;
            });
          } catch (err) {}
        }}
        onPointerUp={(e) => {
          try {
            if (e.pointerType !== "touch") return;
            if (!e.isPrimary) return;
            const el = e.target;
            if (el && el.closest && el.closest('button, input, select, textarea, [role="slider"], .pointer-events-auto')) return;
            if (progressDragRef.current) return;
            // Toggle touch controls
            setShowTouchControls((s) => {
              const next = !s;
              setShowControls(next);
              if (next) {
                if (touchHideTimeoutRef.current) clearTimeout(touchHideTimeoutRef.current);
                touchHideTimeoutRef.current = setTimeout(() => {
                  if (!qualityMenuOpen && !speedMenuOpen) {
                    setShowTouchControls(false);
                    setShowControls(false);
                  }
                }, 5000);
              } else {
                if (touchHideTimeoutRef.current) {
                  clearTimeout(touchHideTimeoutRef.current);
                  touchHideTimeoutRef.current = null;
                }
                clearHideControls();
              }
              return next;
            });
          } catch (err) {}
        }}
      >
        <video
          ref={videoRef}
          controls={showNativeControls || false}
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
            } catch (err) { }
          }}
        ></video>
        {/* Centered spinner while loading */}
        {loading && (
          <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/50">
            <div className="flex flex-col items-center gap-2">
              <svg
                className="w-12 h-12 text-white"
                viewBox="0 0 24 24"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                  fill="none"
                ></circle>
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
                ></path>
              </svg>
              <div className="text-white/90 text-sm">جارٍ التحميل...</div>
            </div>
          </div>
        )}
        {/* top-right fullscreen button removed — fullscreen is available in controls */}
        {/* Overlay feedback for keyboard shortcuts and touch feedback */}
        {/* Central action feedback (play/pause, rate) */}
        {actionFeedback.visible && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-40">
            <div className="flex flex-col items-center gap-2 bg-black/40 text-white/95 px-4 py-3 rounded-xl backdrop-blur-sm">
              <div className="text-3xl">{actionFeedback.icon ? actionFeedback.icon() : null}</div>
              <div className="text-sm font-medium">{actionFeedback.text}</div>
            </div>
          </div>
        )}

        {/* Seek feedback: show left or right side depending on type */}
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

        {/* Rate feedback (playback rate) remains centered beneath actionFeedback */}
        {rateFeedback.visible && !actionFeedback.visible && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-40">
            <div className="flex flex-col items-center gap-2 bg-black/40 text-white/95 px-4 py-3 rounded-xl backdrop-blur-sm">
              <div className="text-2xl font-semibold">{rateFeedback.rate}x</div>
            </div>
          </div>
        )}

        {/* Volume feedback at top center */}
        {typeof volume === "number" && (
          <div id="__volume-feedback-placeholder" />
        )}
        {/* Download progress pill */}
        {isDownloading && (
          <div className="absolute left-4 bottom-4 z-40 pointer-events-none">
            <div className="bg-black/70 text-white px-3 py-2 rounded-lg shadow-lg">
              <div className="flex items-center gap-3">
                <svg className="w-4 h-4" viewBox="0 0 24 24">
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                    fill="none"
                  ></circle>
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
                  ></path>
                </svg>
                <div className="text-sm">
                  {downloadProgress != null
                    ? `جاري التحميل — ${downloadProgress}%`
                    : "جاري التحميل..."}
                </div>
              </div>
            </div>
          </div>
        )}
        {/* Center overlay playback controls (play/pause + back/forward) */}
        {(showControls || showTouchControls) && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-50">
            <div className="flex items-center gap-3 sm:gap-4 md:gap-6 pointer-events-auto">
              <button
                type="button"
                aria-label="تأخير 5 ث"
                onPointerDown={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                  try {
                    const v = videoRef.current;
                    if (!v) return;
                    v.currentTime = Math.max(0, (v.currentTime || 0) - 5);
                    setCurrentTime(v.currentTime);
                    showActionFeedback(Icons.Replay10, "-5s");
                  } catch (err) {}
                }}
                onTouchStart={(e) => {
                  e.stopPropagation();
                }}
                className="flex items-center justify-center w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-black/60 text-white shadow-lg transition-transform transform hover:scale-110 touch-manipulation"
              >
                <Icons.Replay10 />
              </button>

              <button
                type="button"
                aria-label={isPlaying ? "إيقاف" : "تشغيل"}
                onPointerDown={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                  if (isDownloading) return;
                  togglePlayPause();
                }}
                onTouchStart={(e) => {
                  e.stopPropagation();
                }}
                className="flex items-center justify-center w-16 h-16 md:w-20 md:h-20 rounded-full bg-gradient-to-br from-red-600 to-red-700 text-white shadow-2xl transition-transform transform hover:scale-110 touch-manipulation"
              >
                {isDownloading ? (
                  <svg className="w-8 h-8 animate-spin text-white" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"></path>
                  </svg>
                ) : (
                  (isPlaying ? <Icons.PauseCircle /> : <Icons.PlayArrow />)
                )}
              </button>

              <button
                type="button"
                aria-label="تقديم 5 ث"
                onPointerDown={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                  try {
                    const v = videoRef.current;
                    if (!v) return;
                    v.currentTime = Math.min((v.duration || 0), (v.currentTime || 0) + 5);
                    setCurrentTime(v.currentTime);
                    showActionFeedback(Icons.Forward10, "+5s");
                  } catch (err) {}
                }}
                onTouchStart={(e) => {
                  e.stopPropagation();
                }}
                className="flex items-center justify-center w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-black/60 text-white shadow-lg transition-transform transform hover:scale-110 touch-manipulation"
              >
                <Icons.Forward10 />
              </button>
            </div>
          </div>
        )}
        {isDownloading && downloadProgress != null && (
          <div className="absolute left-1/2 -translate-x-1/2 bottom-4 z-40 pointer-events-none w-2/5">
            <div className="w-full h-2 bg-white/20 rounded-full overflow-hidden shadow-inner">
              <div
                className="h-full bg-cyan-500 transition-all"
                style={{ width: `${downloadProgress}%` }}
              />
            </div>
          </div>
        )}
        {error && (
          <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-black/90 to-gray-900/90 backdrop-blur-md">
            <div className="text-center p-8 bg-gradient-to-br from-gray-900 to-black rounded-2xl max-w-sm border border-white/10 shadow-2xl">
              <div className="text-red-400 text-xl mb-4 font-semibold flex items-center justify-center gap-2">
                <span className="text-2xl">⚠️</span> {error}
              </div>
              <button
                onClick={() => {
                  try {
                    retryPlayback();
                  } catch (e) { }
                }}
                className="px-6 py-3 bg-gradient-to-r from-red-600 to-red-700 text-white rounded-xl transition duration-150 shadow-lg active:scale-95 font-medium touch-manipulation"
              >
                إعادة المحاولة
              </button>
            </div>
          </div>
        )}
      </div>

      {/* شريط التقدم تحت الفيديو مع الوقت الحالي والكلي */}
      <div
        className={`absolute left-0 right-0 bottom-16 px-2 transition-opacity duration-200 z-50 bg-black/20 backdrop-blur-sm rounded-md ${showControls || showTouchControls ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"}`}
        onMouseEnter={() => {
          setShowControls(true);
          clearHideControls();
        }}
        onMouseLeave={() => {
          scheduleHideControls(3000);
        }}
        onFocus={() => {
          setShowControls(true);
          clearHideControls();
        }}
        onBlur={() => {
          scheduleHideControls(3000);
        }}
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
              onMouseEnter={() => setHoverProgress(true)}
              onMouseLeave={() => setHoverProgress(false)}
              onKeyDown={(e) => {
                if (!duration || !videoRef.current) return;
                if (e.key === "ArrowRight") {
                  e.preventDefault();
                  const nt = Math.min(
                    duration,
                    (videoRef.current.currentTime || 0) + 5,
                  );
                  videoRef.current.currentTime = nt;
                  setCurrentTime(nt);
                } else if (e.key === "ArrowLeft") {
                  e.preventDefault();
                  const nt = Math.max(
                    0,
                    (videoRef.current.currentTime || 0) - 5,
                  );
                  videoRef.current.currentTime = nt;
                  setCurrentTime(nt);
                } else if (e.key === "Home") {
                  e.preventDefault();
                  videoRef.current.currentTime = 0;
                  setCurrentTime(0);
                } else if (e.key === "End") {
                  e.preventDefault();
                  videoRef.current.currentTime = duration;
                  setCurrentTime(duration);
                }
              }}
              ref={progressRef}
              className={`relative cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 h-3 sm:h-2 bg-gradient-to-r from-gray-800/60 to-gray-800/30 rounded-full shadow-inner`}
              onClick={(e) => {
                e.stopPropagation();
                handleSeek(e);
                if (videoRef.current?.paused) safePlay();
              }}
              onMouseDown={(e) => {
                e.stopPropagation();
                handlePointerSeekStart(e);
              }}
              onPointerDown={(e) => {
                e.stopPropagation();
                handlePointerSeekStart(e);
              }}
              onTouchStart={handleTouchSeekStart}
              onTouchMove={handleTouchSeekMove}
              onTouchEnd={handleTouchSeekEnd}
              onTouchCancel={handleTouchSeekEnd}
            >
              <div
                className="absolute top-0 h-full bg-gradient-to-r from-gray-400/40 to-gray-300/40 rounded-full"
                style={(() => {
                  const rtl = isProgressRtl();
                  return rtl
                    ? { right: 0, width: `${bufferedPercent || 0}%`, zIndex: 0 }
                    : { left: 0, width: `${bufferedPercent || 0}%`, zIndex: 0 };
                })()}
              />

              <div
                className={`absolute top-0 h-full rounded-full relative shadow-lg ${hoverProgress ? "bg-gradient-to-r from-cyan-400 via-cyan-500 to-cyan-600" : "bg-gradient-to-r from-red-500 via-red-600 to-red-700"}`}
                style={(() => {
                  const rtl = isProgressRtl();
                  const w = `${(currentTime / (duration || 1)) * 100 || 0}%`;
                  return rtl
                    ? { right: 0, width: w, zIndex: 1 }
                    : { left: 0, width: w, zIndex: 1 };
                })()}
              />

              <div
                className={`absolute top-1/2 -translate-y-1/2 cursor-pointer transition duration-150 rounded-full bg-white border-3 ${hoverProgress ? "border-cyan-400" : "border-red-600"} shadow-xl active:scale-125`}
                style={(() => {
                  const rtl = isProgressRtl();
                  const pct = `${progressPct}%`;
                  if (rtl)
                    return {
                      right: pct,
                      transform: "translate(50%, -50%)",
                      zIndex: 2,
                      width: isTouchDevice ? "1.6rem" : "0.9rem",
                      height: isTouchDevice ? "1.6rem" : "0.9rem",
                    };
                  return {
                    left: pct,
                    transform: "translate(-50%, -50%)",
                    zIndex: 2,
                    width: isTouchDevice ? "1.6rem" : "0.9rem",
                    height: isTouchDevice ? "1.6rem" : "0.9rem",
                  };
                })()}
                aria-hidden
                />
              </div>
            </div>

          </div>
        </div>


        {/* fullscreen toggle overlay under progress (left) */}
        <div className={`absolute left-4 bottom-6 z-[9999] transition-opacity duration-200 ${showControls || showTouchControls ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"}`}>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              toggleFullscreen();
            }}
            onPointerDown={(e) => {
              e.stopPropagation();
              e.preventDefault();
              toggleFullscreen();
            }}
            onTouchEnd={(e) => {
              e.stopPropagation();
              e.preventDefault();
              toggleFullscreen();
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                toggleFullscreen();
              }
            }}
            className="flex items-center justify-center rounded-full bg-gradient-to-br from-gray-900/80 to-black/80 text-white min-w-[36px] h-8 sm:min-w-[44px] sm:h-11 sm:w-10 shadow-lg transition-transform transform hover:scale-105 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 cursor-pointer hover:bg-white/10 p-1"
            aria-label={isFullscreen ? "خروج من ملء الشاشة" : "ملء الشاشة"}
          >
            {isFullscreen ? <Icons.FullscreenExit /> : <Icons.Fullscreen />}
          </button>
        </div>

        {/* عناصر التحكم النهائية خارج إطار الفيديو */}
      <div
        className={`absolute left-0 right-0 bottom-4 px-2 transition-opacity duration-200 z-50 bg-black/20 backdrop-blur-sm rounded-md ${showControls || showTouchControls ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"}`}
        onMouseEnter={() => {
          setShowControls(true);
          clearHideControls();
        }}
        onMouseLeave={() => {
          scheduleHideControls(3000);
        }}
        onFocus={() => {
          setShowControls(true);
          clearHideControls();
        }}
        onBlur={() => {
          scheduleHideControls(3000);
        }}
      >
        <div className="flex flex-row items-center justify-between gap-2 sm:gap-3">
          <div className="flex items-center gap-2 sm:gap-3 flex-wrap w-full sm:w-auto justify-start">
            <button
              onClick={(e) => {
                e.stopPropagation();
                togglePlayPause();
              }}
              className="flex items-center justify-center rounded-full bg-gradient-to-br from-gray-900 to-black min-w-[44px] h-9 sm:min-w-[56px] sm:h-12 sm:w-14 text-white shadow-2xl active:scale-95 transition-transform transform hover:scale-105 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400"
              aria-label={isPlaying ? "إيقاف" : "تشغيل"}
            >
              {isPlaying ? <Icons.Pause /> : <Icons.Play />}
            </button>

            <button
              onClick={(e) => {
                e.stopPropagation();
                // toggle mute but remember previous volume
                try {
                  if (volume > 0) {
                    prevVolumeRef.current = volume;
                    setVolume(0);
                  } else {
                    setVolume(
                      prevVolumeRef.current != null ? prevVolumeRef.current : 1,
                    );
                  }
                } catch (err) {
                  setVolume(volume === 0 ? 1 : 0);
                }
              }}
              className="flex items-center justify-center rounded-full bg-gradient-to-br from-gray-900/80 to-black/80 min-w-[36px] h-8 sm:min-w-[44px] sm:h-11 sm:w-10 text-white shadow active:scale-95 transition-transform transform hover:scale-105 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400"
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
                // remember last non-zero volume
                if (v > 0) prevVolumeRef.current = v;
                setVolume(v);
              }}
              className="hidden sm:block w-16 sm:w-28 ml-2 accent-red-600"
              aria-label="مستوى الصوت"
            />

            <div
              className="relative hidden sm:block"
              ref={qualityRef}
              onClick={(e) => e.stopPropagation()}
            >
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setQualityMenuOpen((s) => !s);
                  setSpeedMenuOpen(false);
                }}
                className="flex items-center gap-2 rounded-xl bg-gradient-to-br from-gray-900/90 to-black/90 text-white px-2 py-1 shadow-lg border border-white/10 min-w-[36px] h-8 sm:min-w-[44px] sm:h-10 transition-transform transform hover:scale-105 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400"
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
                <div
                  className="absolute bottom-12 right-0 bg-gradient-to-b from-gray-900 to-black border border-white/10 rounded-xl shadow-2xl py-2 z-50 w-52 backdrop-blur-lg max-h-60 overflow-y-auto"
                  onClick={(e) => e.stopPropagation()}
                >
                  {[...video.qualities]
                    .sort((a, b) => parseInt(a.quality) - parseInt(b.quality))
                    .map((q) => (
                      <button
                        key={q.quality}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleQualityChangePersist(q.quality);
                          setQualityMenuOpen(false);
                        }}
                        className={`w-full text-right px-5 py-3 text-sm ${String(q.quality) === String(currentQuality) ? "bg-gradient-to-r from-red-600 to-red-800 text-white font-semibold" : "text-white/80"}`}
                      >
                        <span>{q.quality}p</span>
                      </button>
                    ))}
                </div>
              )}
            </div>

            <div
              className="relative hidden sm:block"
              ref={speedRef}
              onClick={(e) => e.stopPropagation()}
            >
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setSpeedMenuOpen((s) => !s);
                  setQualityMenuOpen(false);
                }}
                className="flex items-center gap-2 rounded-xl bg-gradient-to-br from-gray-900/90 to-black/90 text-white px-2 py-1 shadow-lg border border-white/10 min-w-[36px] h-8 sm:min-w-[44px] sm:h-10 transition-transform transform hover:scale-105 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400"
                aria-expanded={speedMenuOpen}
                aria-label="اختيار السرعة"
              >
                <Icons.Speed />
                <span className="font-medium">
                  {typeof playbackRate === "number"
                    ? playbackRate.toFixed(2)
                    : playbackRate}
                  x
                </span>
                <Icons.ChevronDown />
              </button>
              {speedMenuOpen && (
                <div className="absolute bottom-12 right-0 bg-gradient-to-b from-gray-900 to-black border border-white/10 rounded-2xl shadow-2xl w-40 sm:w-56 p-2 sm:p-3 backdrop-blur-lg z-50">
                  <div className="flex items-center flex-col w-full">
                    <div className="flex items-center justify-center gap-2 sm:gap-3 w-full mb-2 sm:mb-3">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          adjustRate(-rateStep);
                        }}
                        className="bg-black/60 text-white rounded-full w-6 h-6 sm:w-8 sm:h-8 flex items-center justify-center text-lg"
                      >
                        −
                      </button>
                      <div className="text-lg sm:text-2xl font-semibold text-white">
                        {typeof playbackRate === "number"
                          ? playbackRate.toFixed(2)
                          : playbackRate}
                        x
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          adjustRate(rateStep);
                        }}
                        className="bg-black/60 text-white rounded-full w-6 h-6 sm:w-8 sm:h-8 flex items-center justify-center text-lg"
                      >
                        +
                      </button>
                    </div>
                    <div className="w-full">
                      <input
                        type="range"
                        min="0.25"
                        max="3"
                        step="0.05"
                        value={playbackRate}
                        onChange={(e) => {
                          e.stopPropagation();
                          const v =
                            Math.round(parseFloat(e.target.value) * 100) / 100;
                          setPlaybackRate(v);
                          showRateFeedback(v);
                        }}
                        className="w-full accent-red-600"
                        aria-label="شريط سرعة التشغيل"
                      />
                    </div>
                  </div>

                </div>

              )}

            </div>

            {/* Settings for small screens */}
            <div
              className="relative sm:hidden"
              ref={settingsRef}
              onClick={(e) => e.stopPropagation()}
            >
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setSettingsMenuOpen((s) => !s);
                  setQualityMenuOpen(false);
                  setSpeedMenuOpen(false);
                }}
                className="flex items-center justify-center rounded-xl bg-gradient-to-br from-gray-900/90 to-black/90 text-white px-2 py-1 shadow-lg border border-white/10 min-w-[36px] h-8 transition-transform transform hover:scale-105 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400"
              >
                <Icons.Settings />
              </button>
              {settingsMenuOpen && (
                <div className="absolute bottom-12 right-0 bg-gradient-to-b from-gray-900 to-black border border-white/10 rounded-xl shadow-2xl py-2 z-50 w-56 backdrop-blur-lg">
                  <div className="px-3 py-2 text-sm text-white/80">الجودة</div>
                  {video &&
                    video.qualities &&
                    [...video.qualities]
                      .sort((a, b) => parseInt(a.quality) - parseInt(b.quality))
                      .map((q) => (
                        <button
                          key={q.quality}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleQualityChangePersist(q.quality);
                            setSettingsMenuOpen(false);
                          }}
                          className={`w-full text-right px-5 py-2 text-sm ${String(q.quality) === String(currentQuality) ? "bg-gradient-to-r from-red-600 to-red-800 text-white font-semibold" : "text-white/80"}`}
                        >
                          {q.quality}p
                        </button>
                      ))}
                  <div className="px-3 py-2 text-sm text-white/80">السرعة</div>
                  <div className="px-3 py-2">
                    <input
                      type="range"
                      min="0.25"
                      max="3"
                      step="0.05"
                      value={playbackRate}
                      onChange={(e) => {
                        const v =
                          Math.round(parseFloat(e.target.value) * 100) / 100;
                        setPlaybackRate(v);
                        showRateFeedback(v);
                      }}
                      className="w-full accent-red-600"
                    />
                  </div>
                  <div className="px-3 py-2">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        const d = document.querySelector(
                          '[aria-label="تحميل الفيديو"]',
                        );
                        if (d) d.click();
                        setSettingsMenuOpen(false);
                      }}
                      className="w-full text-left px-4 py-2 text-sm bg-black/20 rounded"
                    >
                      تحميل
                    </button>
                  </div>
                  {/* (moved) fullscreen button removed from settings */}
                </div>
              )}
            </div>

            {/* Download button: admin and subscribers can download chosen quality */}
            <div className="relative hidden sm:block">
              <button
                onClick={async (e) => {
                  e.stopPropagation();
                  if (isDownloading) return;
                  // only allow if admin or user explicitly allowed to download
                  if (!(user?.isAdmin || user?.canDownloadVideos)) {
                    setError(
                      "فقط المشرفين والمستخدمين المسموح لهم يمكنهم التحميل",
                    );
                    return;
                  }
                  if (!currentQuality) {
                    setError("اختر جودة أولاً");
                    return;
                  }
                  try {
                    const userCode =
                      typeof window !== "undefined"
                        ? localStorage.getItem("userCode")
                        : null;
                    const downloadUrl = `/api/videos/${video._id}/download?quality=${encodeURIComponent(currentQuality)}${userCode ? `&userCode=${encodeURIComponent(userCode)}` : ""}`;
                    setIsDownloading(true);
                    setDownloadProgress(null);
                    try {
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
                          } catch (e) { }
                        },
                      });
                      const blob = new Blob([res.data], {
                        type:
                          res.headers["content-type"] ||
                          "application/octet-stream",
                      });
                      const url = window.URL.createObjectURL(blob);
                      const cd = res.headers["content-disposition"] || "";
                      let filename = `${video && video.title ? video.title.replace(/[^a-z0-9\-_. ]/gi, "_") : "video"}_${currentQuality}p.ts`;
                      const m = cd.match(/filename\*=UTF-8''([^;\n\r]+)/);
                      if (m && m[1]) filename = decodeURIComponent(m[1]);
                      else {
                        const m2 = cd.match(/filename="?([^";]+)"?/);
                        if (m2 && m2[1]) filename = m2[1];
                      }
                      const a = document.createElement("a");
                      a.href = url;
                      a.download = filename;
                      document.body.appendChild(a);
                      a.click();
                      a.remove();
                      setTimeout(() => window.URL.revokeObjectURL(url), 10000);
                      try {
                        showActionFeedback(Icons.PlayArrow, "تم التحميل");
                      } catch (e) { }
                    } catch (err) {
                      console.error(
                        "download error",
                        err && err.response ? err.response.status : err,
                      );
                      const msg = err?.response?.data?.message || "فشل التحميل";
                      setError(msg);
                    } finally {
                      setIsDownloading(false);
                      setTimeout(() => setDownloadProgress(null), 800);
                    }
                  } catch (err) {
                    console.error(err);
                    setError("فشل بدء التحميل");
                    setIsDownloading(false);
                  }
                }}
                className={`flex items-center gap-2 rounded-xl bg-gradient-to-br from-gray-900/90 to-black/90 text-white px-2 py-1 shadow-lg border border-white/10 min-w-[36px] h-8 sm:min-w-[44px] sm:h-10 transition-transform transform hover:scale-105 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 ${!isLoggedIn && !user?.isAdmin ? "opacity-50 cursor-not-allowed" : ""}`}
                aria-label="تحميل الفيديو"
                disabled={isDownloading}
              >
                {isDownloading ? (
                  <>
                    <svg className="w-4 h-4" viewBox="0 0 24 24">
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                        fill="none"
                      ></circle>
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
                      ></path>
                    </svg>
                    <span className="font-medium">
                      {downloadProgress != null
                        ? `تحميل ${downloadProgress}%`
                        : "جاري التحميل..."}
                    </span>
                  </>
                ) : (
                  <>
                    <svg
                      className="w-5 h-5"
                      viewBox="0 0 24 24"
                      fill="none"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <path
                        d="M12 3V15"
                        stroke="currentColor"
                        strokeWidth="1.6"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                      <path
                        d="M8 11L12 15L16 11"
                        stroke="currentColor"
                        strokeWidth="1.6"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                      <path
                        d="M21 21H3"
                        stroke="currentColor"
                        strokeWidth="1.6"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
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
  );
}

export default React.memo(VideoPlayer);
