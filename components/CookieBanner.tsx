"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";

export function CookieBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!localStorage.getItem("cookie-consent")) {
      setVisible(true);
    }
  }, []);

  const accept = () => {
    localStorage.setItem("cookie-consent", "accepted");
    window.dispatchEvent(new Event("cookie-consent-accepted"));
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 border-t bg-background/95 backdrop-blur-sm">
      <div className="mx-auto max-w-5xl px-4 py-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <p className="text-xs text-muted-foreground">
          This site uses cookies for anonymous analytics (Google Analytics) to
          help us understand how it's being used. No personal data is collected
          or stored on our servers.
        </p>
        <Button size="sm" className="shrink-0" onClick={accept}>
          Got it
        </Button>
      </div>
    </div>
  );
}
