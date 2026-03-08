"use client";

import { useEffect, useState } from "react";
import Script from "next/script";

export function GoogleAnalytics() {
  const [consented, setConsented] = useState(false);

  useEffect(() => {
    if (localStorage.getItem("cookie-consent") === "accepted") {
      setConsented(true);
      return;
    }
    const handler = () => setConsented(true);
    window.addEventListener("cookie-consent-accepted", handler);
    return () => window.removeEventListener("cookie-consent-accepted", handler);
  }, []);

  if (!consented) return null;

  return (
    <>
      <Script
        src="https://www.googletagmanager.com/gtag/js?id=G-QQBNNCZTMY"
        strategy="afterInteractive"
      />
      <Script id="google-analytics" strategy="afterInteractive">
        {`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          gtag('js', new Date());
          gtag('config', 'G-QQBNNCZTMY');
        `}
      </Script>
    </>
  );
}
