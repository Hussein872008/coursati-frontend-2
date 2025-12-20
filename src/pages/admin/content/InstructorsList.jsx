import React from "react";
import { Navigate, useParams } from "react-router-dom";
import useTitle from "../../../hooks/useTitle";

// This page was removed because instructor listing is handled inside MaterialDetail.
// Keep a small redirect here so any stray links still resolve to the material page.
const InstructorsList = () => {
  const { materialId } = useParams();
  useTitle("كورساتي — مدرسين المادة (إدارة)");
  return <Navigate to={`/admin/content/materials/${materialId}`} replace />;
};

export default InstructorsList;
