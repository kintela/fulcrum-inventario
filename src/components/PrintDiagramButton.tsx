"use client";

import { useCallback, useRef } from "react";

type PrintDiagramButtonProps = {
  className?: string;
};

export default function PrintDiagramButton({ className }: PrintDiagramButtonProps) {
  const isPrintingRef = useRef(false);

  const handlePrint = useCallback(() => {
    if (typeof window === "undefined" || typeof document === "undefined") return;
    if (isPrintingRef.current) return;
    isPrintingRef.current = true;

    const styleEl = document.createElement("style");
    styleEl.setAttribute("data-print-style", "switches-graph");
    styleEl.media = "print";
    styleEl.textContent = `
      @page {
        size: landscape;
        margin: 12mm;
      }

      body {
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }

      @media print {
        body {
          margin: 0;
          padding: 0;
          background: white;
        }

        body * {
          visibility: hidden !important;
        }

        #switches-graph-print-area,
        #switches-graph-print-area * {
          visibility: visible !important;
        }

        .printable-graph {
          position: fixed;
          inset: 0;
          margin: 0;
          padding: 16mm 12mm 12mm;
          width: 100vw;
          height: 100vh;
          box-sizing: border-box;
          overflow: visible !important;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .printable-graph > * {
          width: 100%;
          height: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .printable-graph > .printable-graph-inner {
          width: 100vw;
          height: 100vh;
          border: none !important;
          background: transparent !important;
          padding: 0 !important;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        #switches-graph-print-area svg {
          display: block;
          width: auto !important;
          height: calc(100vh - 70mm) !important;
          max-height: calc(100vh - 70mm);
          max-width: calc(100vw - 50mm);
          margin: 0 auto;
        }
      }
    `;
    document.head.appendChild(styleEl);

    const cleanup = () => {
      if (styleEl.parentNode) {
        styleEl.parentNode.removeChild(styleEl);
      }
      window.removeEventListener("afterprint", cleanup);
      isPrintingRef.current = false;
    };

    window.addEventListener("afterprint", cleanup);
    window.print();

    // Fallback cleanup in case afterprint does not fire.
    window.setTimeout(() => {
      if (isPrintingRef.current) {
        cleanup();
      }
    }, 10000);
  }, []);

  const classes = [
    "inline-flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-sm font-semibold text-foreground transition hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-primary/30 cursor-pointer",
    "disabled:cursor-not-allowed disabled:opacity-50",
    className ?? "",
  ]
    .join(" ")
    .trim();

  return (
    <button
      type="button"
      onClick={handlePrint}
      className={classes}
      title="Imprimir gráfico de conexiones"
      aria-label="Imprimir gráfico de conexiones"
    >
      <svg
        aria-hidden="true"
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        className="h-5 w-5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M17 9V4H7v5m10 0h1a3 3 0 0 1 3 3v4h-4m0 0v4H7v-4m10 0H7m0 0H3v-4a3 3 0 0 1 3-3h1m0 0h10"
        />
        <path strokeLinecap="round" d="M17 13H7v6h10z" />
      </svg>
      <span>Imprimir</span>
    </button>
  );
}
