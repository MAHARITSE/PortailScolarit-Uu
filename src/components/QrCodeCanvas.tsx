import { useMemo } from 'react';
import QRCode from 'qrcode';

interface QrCodeCanvasProps {
  value: string;
  size?: number;
  className?: string;
}

export function QrCodeCanvas({ value, size = 104, className = '' }: QrCodeCanvasProps) {
  const svgData = useMemo(() => {
    try {
      const qr = QRCode.create(value, { errorCorrectionLevel: 'M' });
      const count = qr.modules.size;
      const margin = 1;
      const total = count + margin * 2;
      const parts: string[] = [];

      for (let r = 0; r < count; r++) {
        let runStart = -1;
        for (let c = 0; c <= count; c++) {
          const isDark = c < count && Boolean(qr.modules.get(r, c));
          if (isDark && runStart === -1) {
            runStart = c;
          } else if (!isDark && runStart !== -1) {
            const len = c - runStart;
            parts.push(`M${runStart + margin},${r + margin}h${len}v1h-${len}z`);
            runStart = -1;
          }
        }
      }

      return {
        viewBox: `0 0 ${total} ${total}`,
        path: parts.join(''),
      };
    } catch {
      return null;
    }
  }, [value]);

  if (!svgData) {
    return (
      <div
        style={{ width: size, height: size }}
        className={`border border-slate-300 bg-slate-50 flex items-center justify-center text-[10px] text-slate-400 ${className}`}
      >
        QR
      </div>
    );
  }

  return (
    <svg
      role="img"
      aria-label="Code QR de vérification du certificat"
      width={size}
      height={size}
      viewBox={svgData.viewBox}
      shapeRendering="crispEdges"
      className={`block border border-slate-200 bg-white ${className}`}
    >
      <rect width="100%" height="100%" fill="#ffffff" />
      <path d={svgData.path} fill="#0f172a" />
    </svg>
  );
}
