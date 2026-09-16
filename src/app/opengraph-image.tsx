import { ImageResponse } from "next/og";
import { SITE_NAME, SITE_TAGLINE } from "@/lib/site";

// Social card for the public pages. Rendered at build/request time by next/og (Satori), so this is
// plain flex layout only - no Tailwind, no CSS variables.
export const alt = `${SITE_NAME} - ${SITE_TAGLINE}`;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpengraphImage() {
    return new ImageResponse(
        (
            <div
                style={{
                    height: "100%",
                    width: "100%",
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "space-between",
                    backgroundColor: "#fafafa",
                    color: "#171717",
                    padding: 72,
                }}
            >
                <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
                    <div
                        style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            width: 64,
                            height: 64,
                            borderRadius: 16,
                            backgroundColor: "#171717",
                            color: "#ffffff",
                            fontSize: 40,
                            fontWeight: 600,
                        }}
                    >
                        q
                    </div>
                    <div style={{ display: "flex", fontSize: 36, fontWeight: 600, letterSpacing: -0.5 }}>{SITE_NAME}</div>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
                    <div style={{ display: "flex", fontSize: 68, fontWeight: 600, letterSpacing: -1.5, lineHeight: 1.1, maxWidth: 900 }}>
                        {`${SITE_TAGLINE}.`}
                    </div>
                    <div style={{ display: "flex", fontSize: 30, color: "#525252", maxWidth: 860, lineHeight: 1.35 }}>
                        Toggle items on and off per job, match a job description, download a real PDF.
                    </div>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: 16, fontSize: 24, color: "#a3a3a3" }}>
                    <div style={{ display: "flex", width: 120, height: 2, backgroundColor: "#e5e5e5" }} />
                    <div style={{ display: "flex" }}>Typeset with Typst, compiled in your browser</div>
                </div>
            </div>
        ),
        size,
    );
}
