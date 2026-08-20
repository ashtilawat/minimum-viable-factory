"use client";

import { useState } from "react";

type ShareButtonProps = {
  shareText: string;
  disabled?: boolean;
};

export default function ShareButton({ shareText, disabled }: ShareButtonProps) {
  const [copied, setCopied] = useState(false);

  async function handleShare() {
    if (disabled || !shareText) return;
    try {
      await navigator.clipboard.writeText(shareText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard unavailable */
    }
  }

  return (
    <button
      type="button"
      className="share-button"
      data-testid="share-button"
      disabled={disabled || !shareText}
      onClick={handleShare}
    >
      {copied ? "Copied!" : "Share"}
    </button>
  );
}
