import React, { useState, useEffect, useRef } from "react";
import { toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { useNavigate, useLocation } from "react-router-dom";
import useTitle from "../../hooks/useTitle";
import { authAPI } from "../../utils/api";
import { useAuth } from "../../hooks/useAuth";

const LoginPage = () => {
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [shake, setShake] = useState(false);
  const [focus, setFocus] = useState(false);
  const [pulse, setPulse] = useState(true);
  const [showCode, setShowCode] = useState(false);
  const [codeWarning, setCodeWarning] = useState("");
  // removed local toast state; using react-toastify instead

  const navigate = useNavigate();
  const { login } = useAuth();
  const location = useLocation();

  useTitle("كورساتي — تسجيل الدخول");

  const inputRef = useRef(null);
  // WhatsApp contact (change phone and message as needed)
  const whatsappPhone = "201070334275";

  // رسالة طلب كود دخول جديد
  const getNewCodeMessage = () => {
    return encodeURIComponent("مرحبا، أريد الحصول على كود دخول جديد للمنصة.");
  };

  // رسالة تجديد اشتراك (للكود المنتهي)
  const getRenewalMessage = () => {
    const storedUser = localStorage.getItem("userData");
    const userName = storedUser ? JSON.parse(storedUser)?.name : "";
    const messageBase = "مرحبا، أريد تجديد اشتراكي";
    const parts = [messageBase];
    if (userName) parts.push(`اسمي: ${userName}`);
    if (code.length === 9) parts.push(`كودي الحالي: ${code}`);
    return encodeURIComponent(parts.join("\n"));
  };

  // استرجاع آخر كود تم إدخاله
  useEffect(() => {
    const lastCode = localStorage.getItem("last_login_code");
    if (lastCode && lastCode.length === 9 && /^\d+$/.test(lastCode)) {
      setCode(lastCode);
    }
  }, []);

  // Show expired-subscription message when redirected with ?expired=1
  useEffect(() => {
    try {
      const params = new URLSearchParams(location.search);
      if (params.get("expired") === "1") {
        const waLink = `https://wa.me/${whatsappPhone}?text=${encodeURIComponent("مرحبا، كود الاشتراك بتاعي انتهت صلاحيته. ممكن تجدد الكود؟\nالاسم:\nوسيلة التواصل:")}`;
        setCodeWarning(
          <a
            href={waLink}
            target="_blank"
            rel="noopener noreferrer"
            className="text-amber-200 underline"
          >
            كود الاشتراك بتاعك انتهت صلاحيته. كلم الأدمن لتجديد الكود.
          </a>,
        );
      }
    } catch (e) {
      // ignore
    }
  }, [location.search]);

  // إخفاء شريط التمرير على مستوى الـ body أثناء وجود هذه الصفحة
  useEffect(() => {
    const prevBodyOverflow = document.body.style.overflow;
    const prevDocOverflowX = document.documentElement.style.overflowX;
    document.body.style.overflow = "hidden";
    document.documentElement.style.overflowX = "hidden";
    return () => {
      document.body.style.overflow = prevBodyOverflow || "";
      document.documentElement.style.overflowX = prevDocOverflowX || "";
    };
  }, []);

  // تركيز تلقائي على حقل الإدخال عند فتح الصفحة
  useEffect(() => {
    const t = setTimeout(() => {
      inputRef.current?.focus();
    }, 80);
    return () => clearTimeout(t);
  }, []);

  // تأثير النبض للتكرار
  useEffect(() => {
    const interval = setInterval(() => {
      setPulse((prev) => !prev);
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setShake(false);

    // التحقق من صحة الكود (9 أرقام)
    if (!code || code.length !== 9 || !/^\d+$/.test(code)) {
      setError("الكود يجب أن يتكون من 9 أرقام فقط");
      setShake(true);
      setTimeout(() => setShake(false), 500);
      setLoading(false);
      return;
    }

    try {
      // ensure a persistent deviceId exists for this browser
      try {
        let deviceId = localStorage.getItem("deviceId");
        if (!deviceId) {
          if (window.crypto && crypto.randomUUID)
            deviceId = crypto.randomUUID();
          else deviceId = "dev-" + Math.random().toString(36).slice(2, 12);
          localStorage.setItem("deviceId", deviceId);
        }
      } catch (e) {
        // ignore storage issues
      }
      // حفظ الكود محلياً
      localStorage.setItem("last_login_code", code);

      // محاولة الدخول كإدمن أولاً
      let response;
      try {
        response = await authAPI.adminLogin(code);
      } catch (adminError) {
        const status = adminError?.response?.status;
        const messageFromServer = adminError?.response?.data?.message;
        // إذا تم رفض دخول الأدمن بسبب ارتباط الجهاز، عرض رسالة مخصصة ولا تحاول دخول المستخدم العادي
        if (status === 403) {
          setError(
            messageFromServer || "تم رفض الدخول: الحساب مرتبط بمتصفح آخر",
          );
          setShake(true);
          setTimeout(() => setShake(false), 500);
          setLoading(false);
          return;
        }
        // خلاف ذلك، حاول الدخول كمستخدم عادي
        response = await authAPI.userLogin(code);
      }

      // store sessionToken returned by backend so subsequent requests include it
      try {
        const token = response?.data?.user?.sessionToken;
        if (token) localStorage.setItem("sessionToken", token);
      } catch (e) {}

      login(response.data.user, code);
      // Show success toast using react-toastify
      try {
        toast.success("تم تسجيل الدخول بنجاح");
      } catch (e) {
        /* ignore if toast unavailable */
      }

      // تأثير انتقال قبل التوجيه
      await new Promise((resolve) => setTimeout(resolve, 500));

      // توجيه بناءً على نوع المستخدم
      if (response.data.user.isAdmin) {
        navigate("/admin/dashboard");
      } else {
        navigate("/");
      }
    } catch (err) {
      setError(err.response?.data?.message || "فشل الدخول، تأكد من صحة الكود");
      setShake(true);
      setTimeout(() => setShake(false), 500);
    } finally {
      setLoading(false);
    }
  };

  // معالجة تغيير المدخلات مع التأثيرات
  const handleCodeChange = (e) => {
    const value = e.target.value.replace(/\D/g, "").slice(0, 9);
    setCode(value);
    if (error) setError("");
  };

  // تحسين تنسيق الكود للعرض
  const formatCodeForDisplay = (code) => {
    if (!code) return "";
    return code.replace(/(\d{3})(?=\d)/g, "$1 ");
  };

  // تأثيرات الشرارة عند الكتابة — تحسّن الموضع ليكون مناسبًا للحاوية
  const createSparkle = (pageX, pageY) => {
    const container = document.querySelector(".sparkle-container");
    if (!container) return;
    const cRect = container.getBoundingClientRect();
    const left = pageX - cRect.left;
    const top = pageY - cRect.top;

    const sparkles = document.createElement("div");
    sparkles.className = "absolute w-1 h-1 bg-yellow-400 rounded-full";
    sparkles.style.left = `${left}px`;
    sparkles.style.top = `${top}px`;
    sparkles.style.boxShadow = "0 0 10px 2px #fbbf24";
    sparkles.style.pointerEvents = "none";
    container.appendChild(sparkles);

    requestAnimationFrame(() => {
      sparkles.style.transition = "transform 300ms ease, opacity 300ms ease";
      sparkles.style.transform = `translate(${Math.random() * 20 - 10}px, ${Math.random() * 20 - 10}px) )`;
      sparkles.style.opacity = "0";
    });

    setTimeout(() => sparkles.remove(), 350);
  };

  return (
    <div
      className="min-h-screen relative overflow-hidden flex items-center justify-center"
      dir="rtl"
    >
      {/* الحاوية الرئيسية */}
      <div className="relative z-10 w-full max-w-sm sm:max-w-md px-4 mx-auto mt-6 sm:mt-0">
        {/* كارت الدخول مع تأثيرات زجاجية */}
        <div
          className={`relative bg-white/5 backdrop-blur-xl rounded-3xl shadow-2xl p-8 transform transition-all duration-700 `}
        >
          {/* حدود إضاءة */}
          <div className="absolute inset-0 rounded-3xl bg-gradient-to-r from-blue-500/20 via-transparent to-purple-500/20 p-[2px] -z-10">
            <div className="absolute inset-0 rounded-3xl bg-gradient-to-r from-blue-500/10 via-transparent to-purple-500/10 animate-pulse" />
          </div>

          {/* شعار مع تأثير النيون */}
          <div className="text-center mb-10 relative">
            <div className="absolute -top-4 -right-4 w-32 h-32 bg-blue-500/10 rounded-full blur-xl" />
            <h1 className="text-4xl sm:text-5xl font-black bg-gradient-to-r from-cyan-400 via-blue-500 to-purple-500 bg-clip-text text-transparent mb-3 relative z-20 leading-tight">
              كورساتي
              <span className="absolute -inset-1 bg-gradient-to-r from-cyan-400/20 via-blue-500/20 to-purple-500/20 blur-xl -z-10" />
            </h1>
            <p className="text-lg text-cyan-200 font-medium tracking-wide">
              نظام إدارة التعلم الذكي
            </p>
          </div>

          {/* حاوية التأثيرات */}
          <div className="sparkle-container relative">
            <form onSubmit={handleLogin} className="space-y-8">
              {/* حقل إدخال الكود مع تأثيرات متطورة */}
              <div className="space-y-6">
                <label className="text-xl font-bold text-white mb-3 flex items-center gap-2">
                  <span className="bg-gradient-to-r from-cyan-500 to-blue-500 p-2 rounded-lg">
                    🔒
                  </span>
                  <span>كود الدخول</span>
                </label>

                <div className={`relative transition-all duration-500`}>
                  <div className="absolute -inset-1 bg-gradient-to-r from-cyan-500 via-blue-500 to-purple-500 rounded-2xl blur opacity-30 group-hover:opacity-100 transition duration-1000" />
                  <div className="relative">
                    <div className="relative">
                      <div className="flex gap-2 sm:gap-3 justify-center mt-2 items-center flex-wrap w-full">
                        <input
                          ref={inputRef}
                          type={showCode ? "text" : "password"}
                          autoComplete="one-time-code"
                          value={code}
                          onChange={(e) => {
                            handleCodeChange(e);
                            const rect =
                              inputRef.current?.getBoundingClientRect();
                            if (rect)
                              createSparkle(
                                rect.left + rect.width / 2,
                                rect.top + rect.height / 2,
                              );
                          }}
                          onPaste={(e) => {
                            const pasted =
                              (e.clipboardData || window.clipboardData).getData(
                                "text",
                              ) || "";
                            const digits = pasted
                              .replace(/\D/g, "")
                              .slice(0, 9);
                            if (digits) {
                              setCode(digits);
                            }
                            e.preventDefault();
                          }}
                          onFocus={() => setFocus(true)}
                          onBlur={() => setFocus(false)}
                          placeholder={"••• ••• •••"}
                          className={`w-full sm:w-80 text-center px-4 py-4 text-lg sm:text-xl bg-gray-900/50 backdrop-blur-sm border-2 rounded-2xl focus:outline-none transition-all duration-300 text-white placeholder-gray-400 ${
                            error
                              ? "border-red-500/50 bg-red-900/20 focus:ring-4 focus:ring-red-500/30"
                              : "border-cyan-500/30 focus:border-cyan-400 focus:ring-4 focus:ring-cyan-500/30"
                          } ${shake ? "animate-[shake_0.5s_ease-in-out]" : ""} ${code.length === 9 && loading ? "cursor-not-allowed opacity-90" : ""}`}
                          maxLength={9}
                          inputMode="numeric"
                          dir="ltr"
                          aria-label={`حقل كود الدخول`}
                        />

                        {/* زر إظهار/إخفاء الكود */}
                        {code.length > 0 && (
                          <button
                            type="button"
                            onClick={() => setShowCode(!showCode)}
                            className="p-2 text-gray-400 hover:text-white transition-colors duration-200"
                            aria-label={
                              showCode ? "إخفاء الكود" : "إظهار الكود"
                            }
                          >
                            {showCode ? (
                              <svg
                                className="w-5 h-5"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth="2"
                                  d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                                />
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth="2"
                                  d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                                />
                              </svg>
                            ) : (
                              <svg
                                className="w-5 h-5"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth="2"
                                  d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L6.59 6.59m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"
                                />
                              </svg>
                            )}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* رسائل توجيهية */}
                {codeWarning && (
                  <div className="mt-3 p-3 bg-amber-900/20 border border-amber-500/30 rounded-xl animate-[slideIn_0.3s_ease-out]">
                    <div className="flex items-center gap-2 flex-col sm:flex-row">
                      <svg
                        className="w-5 h-5 text-amber-400 flex-shrink-0"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth="2"
                          d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                        />
                      </svg>
                      <div className="flex-1 flex flex-col sm:flex-row items-center gap-2">
                        <p className="text-sm text-amber-300">
                          كود الاشتراك بتاعك انتهت صلاحيته.
                        </p>
                        <a
                          href={`https://wa.me/${whatsappPhone}?text=${getRenewalMessage()}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-amber-200 underline hover:text-amber-100 transition-colors font-semibold"
                        >
                          كلم الأدمن لتجديد الكود
                        </a>
                      </div>
                    </div>
                  </div>
                )}
                {/* عداد الأحرف مع تأثير */}
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <div
                      className={`w-3 h-3 rounded-full transition-all duration-300 ${code.length === 9 ? "bg-green-500 animate-pulse" : "bg-amber-500"}`}
                    />
                    <span
                      className={`text-sm font-medium transition-all duration-300 ${code.length === 9 ? "text-green-400" : "text-gray-400"}`}
                    >
                      {code.length === 9 ? "الكود مكتمل" : "أدخل 9 أرقام"}
                    </span>
                  </div>
                  <span
                    className={`text-lg font-bold px-3 py-1 rounded-lg transition-all duration-300 ${code.length === 9 ? "bg-green-500/20 text-green-400" : "bg-gray-800 text-gray-400"}`}
                  >
                    {code.length} / 9
                  </span>
                </div>
              </div>

              {/* رسالة الخطأ مع تأثير */}
              {error && (
                <div className="animate-[slideIn_0.3s_ease-out] p-4 bg-gradient-to-r from-red-900/30 to-red-800/20 backdrop-blur-sm border border-red-500/30 rounded-xl">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-red-500/20 rounded-lg">
                      <svg
                        className="w-6 h-6 text-red-400"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth="2"
                          d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                        />
                      </svg>
                    </div>
                    <p className="text-red-200 font-semibold">{error}</p>
                  </div>
                </div>
              )}

              {/* زر الدخول مع تأثيرات متطورة */}
              <button
                type="submit"
                disabled={loading}
                className={`relative w-full py-4 sm:py-5 px-4 sm:px-6 rounded-2xl font-bold text-lg sm:text-xl transition-all duration-500 transform overflow-hidden group ${
                  loading
                    ? "bg-gradient-to-r from-gray-700 to-gray-800 cursor-not-allowed"
                    : "bg-gradient-to-r from-cyan-600 via-blue-600 to-purple-600 hover:from-cyan-500 hover:via-blue-500 hover:to-purple-500  active:scale-[0.98] shadow-2xl hover:shadow-cyan-500/25"
                }`}
              >
                {/* تأثير الخلفية المتحركة */}
                <div className="absolute inset-0 bg-gradient-to-r from-cyan-500/0 via-white/10 to-purple-500/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000" />

                <div className="relative flex items-center justify-center gap-3 text-white">
                  {loading ? (
                    <>
                      <svg
                        className="animate-spin h-6 w-6"
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                      >
                        <circle
                          className="opacity-25"
                          cx="12"
                          cy="12"
                          r="10"
                          stroke="currentColor"
                          strokeWidth="4"
                        />
                        <path
                          className="opacity-75"
                          fill="currentColor"
                          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                        />
                      </svg>
                      <span className="text-lg">جاري التحقق...</span>
                    </>
                  ) : (
                    <>
                      <span className="text-lg">دخول إلى المنصة</span>
                      <div className="p-2 bg-white/20 rounded-lg group-hover:bg-white/30 transition-colors duration-300">
                        <svg
                          className="w-5 h-5 transform group-hover:translate-x-1 transition-transform duration-300"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth="2"
                            d="M13 7l5 5m0 0l-5 5m5-5H6"
                          />
                        </svg>
                      </div>
                    </>
                  )}
                </div>
              </button>
            </form>
          </div>

          {/* معلومات إضافية مع تأثيرات */}
          <div className="mt-10 pt-8 border-t border-white/10">
            <div className="text-center text-gray-300 mb-6">
              <p className="text-sm text-gray-400">
                يمكنك التواصل معنا للحصول على كود اشتراك والوصول إلى جميع
                المحتويات المميزة
              </p>
            </div>

            {/* لو معندكش كود؟ كلمنا أو اطلب عبر واتساب */}
            <div className="mt-6 flex flex-col items-center gap-3">
              <a
                href={`https://wa.me/${whatsappPhone}?text=${getNewCodeMessage()}`}
                target="_blank"
                rel="noopener noreferrer"
                className="group relative w-full sm:w-auto px-4 sm:px-6 py-3 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-semibold shadow-lg hover:shadow-emerald-500/25 transition-all duration-300 inline-flex items-center justify-center"
                aria-label="تواصل لطلب كود"
              >
                <div className="absolute -inset-1 bg-gradient-to-r from-emerald-500 to-teal-500 rounded-xl blur opacity-30 group-hover:opacity-50 transition duration-500" />
                <div className="relative flex items-center gap-3">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-5 w-5  transition-transform"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                    />
                  </svg>
                  <span>طلب كود دخول</span>
                </div>
              </a>
            </div>
          </div>
        </div>

        {/* فقاعة معلومات في الأسفل */}
        <div className="mt-8 text-center text-sm text-gray-400">
          <p>© 2025 كورساتي. جميع الحقوق محفوظة</p>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
