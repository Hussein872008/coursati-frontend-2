import React from "react";
import { Navigate, useParams } from "react-router-dom";
import useTitle from "../../../hooks/useTitle";

// This page was removed because it's duplicated by the instructor detail view.
// Keep a redirect so any existing links continue to work.
const ChaptersList = () => {
  const { materialId } = useParams();
  useTitle("كورساتي — الفصول (إدارة)");
  return <Navigate to={`/admin/content/materials/${materialId}`} replace />;
};

export default ChaptersList;
