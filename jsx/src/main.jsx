import { StrictMode, useState, Suspense, lazy } from "react";
import { createRoot } from "react-dom/client";

// ── Page registry ─────────────────────────────────────────────────────────────
// To add a new page, just append an entry here.
const pages = [
  { id: "archi",               label: "🏗  Architecture",        component: lazy(() => import("../archi.jsx"))               },
  { id: "database",            label: "🗄  Database",             component: lazy(() => import("../database.jsx"))            },
  { id: "phases_func_mapping", label: "🗺  Phase → Goals",        component: lazy(() => import("../phases_func_mapping.jsx")) },
  { id: "detailed_roadmap",    label: "📅  Detailed Roadmap",     component: lazy(() => import("../detailed_roadmap.jsx"))    },
];

const menuStyle = {
  display: "flex",
  gap: "10px",
  padding: "10px 16px",
  background: "#070B14",
  borderBottom: "1px solid #1E2D45",
  position: "sticky",
  top: 0,
  zIndex: 9999,
  flexWrap: "wrap",
};

const btnStyle = (active) => ({
  padding: "6px 16px",
  borderRadius: "6px",
  border: "1px solid",
  cursor: "pointer",
  fontFamily: "'IBM Plex Mono', monospace",
  fontSize: "13px",
  background: active ? "#00A8E8" : "transparent",
  color: active ? "#070B14" : "#00A8E8",
  borderColor: "#00A8E8",
  fontWeight: active ? "700" : "400",
  transition: "all 0.15s",
});

function Launcher() {
  const [activeId, setActiveId] = useState(pages[0].id);
  const Page = pages.find((p) => p.id === activeId)?.component;

  return (
    <>
      <nav style={menuStyle}>
        {pages.map((p) => (
          <button
            key={p.id}
            style={btnStyle(p.id === activeId)}
            onClick={() => setActiveId(p.id)}
          >
            {p.label}
          </button>
        ))}
      </nav>
      <Suspense fallback={<div style={{ color: "#C8D8E8", padding: 32 }}>Loading…</div>}>
        {Page && <Page />}
      </Suspense>
    </>
  );
}

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <Launcher />
  </StrictMode>
);
