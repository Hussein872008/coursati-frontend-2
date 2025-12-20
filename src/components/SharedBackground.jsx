import React from "react";

// Simplified static background to remove heavy canvas animation and CSS animations.
// This intentionally sacrifices visuals for performance under heavy load.
const SharedBackground = React.memo(() => {
  return (
    <>
      <div
        className="fixed inset-0 pointer-events-none bg-gradient-to-br from-gray-900 via-blue-900 to-purple-900"
        style={{ zIndex: 0 }}
      />
      <div className="fixed inset-0 pointer-events-none" style={{ zIndex: 0 }}>
        <div className="absolute top-12 left-12 w-72 h-72 bg-blue-500/6 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-12 right-12 w-80 h-80 bg-purple-500/6 rounded-full blur-3xl pointer-events-none" />
      </div>
    </>
  );
});

export default SharedBackground;
