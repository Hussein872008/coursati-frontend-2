import React from "react";
import ScrollToTopButton from "./ScrollToTopButton";

const UserFooter = () => {
  const currentYear = new Date().getFullYear();
  const creatorName = "Hussein Abdalla";
  const creatorLink = "https://www.facebook.com/husseinabdalla010";

  return (
    <>
      <footer className="mt-12 border-t border-white/10">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            {/* حقوق النشر */}
            <div className="text-white/60 text-sm text-center md:text-right">
              © {currentYear} كورساتي. جميع الحقوق محفوظة.
            </div>

            {/* رابط المنشئ */}
            <div className="flex items-center gap-4">
              <div className="text-white/60 text-sm flex items-center gap-1">
                <span>تصميم وتطوير</span>
                <a
                  href={creatorLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-400 hover:text-blue-300 transition-colors duration-200 font-medium hover:underline flex items-center gap-1"
                >
                  {creatorName}
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-4 w-4"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                    />
                  </svg>
                </a>
              </div>
            </div>
          </div>
        </div>
      </footer>

      <ScrollToTopButton />
    </>
  );
};

export default UserFooter;
