import { useState } from 'react';
import { AboutUsModal } from './AboutUsModal';

export function Logo() {
  const [isAboutUsOpen, setIsAboutUsOpen] = useState(false);

  return (
    <>
      <div className="flex items-center gap-6">
        <div className="flex items-center gap-3">
          <svg
            width="40"
            height="40"
            viewBox="0 0 40 40"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className="flex-shrink-0"
          >
            <path
              d="M20 4 L17 18 L20 16 L23 18 Z"
              fill="#FF8C00"
              stroke="#FF8C00"
              strokeWidth="0.5"
              strokeLinejoin="miter"
            />

            <path
              d="M36 20 L22 17 L24 20 L22 23 Z"
              fill="#333333"
            />

            <path
              d="M20 36 L17 22 L20 24 L23 22 Z"
              fill="#333333"
            />

            <path
              d="M4 20 L18 17 L16 20 L18 23 Z"
              fill="#333333"
            />

            <circle
              cx="20"
              cy="20"
              r="3"
              fill="white"
              stroke="#333333"
              strokeWidth="1"
            />
          </svg>

          <div className="text-2xl font-bold leading-none">
            <span className="text-[#003366]">Vantage</span>
            <span className="text-[#FF8C00]">PM</span>
          </div>
        </div>

        <button
          onClick={() => setIsAboutUsOpen(true)}
          className="text-sm font-medium text-blue-600 hover:text-blue-700 hover:underline transition-colors"
        >
          About Us
        </button>
      </div>

      <AboutUsModal
        isOpen={isAboutUsOpen}
        onClose={() => setIsAboutUsOpen(false)}
      />
    </>
  );
}
