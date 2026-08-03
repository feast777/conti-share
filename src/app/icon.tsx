import { ImageResponse } from "next/og";

/** 파비콘 — 브랜드 심볼(W 파형)을 파란 라운드 사각 위에 */
export const size = { width: 32, height: 32 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#2b6cb0",
          borderRadius: 7,
        }}
      >
        <svg
          width="22"
          height="22"
          viewBox="0 0 24 24"
          fill="none"
          stroke="#ffffff"
          strokeWidth={2.6}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M3 7l3.2 10L12 9l5.8 8L21 7" />
        </svg>
      </div>
    ),
    size
  );
}
