"use client";

import Image from "next/image";
import { AlertTriangle } from "lucide-react";
import { useState } from "react";

interface Props {
  src: string;
  alt: string;
  label: string;
}

export function GuideStepImage({ src, alt, label }: Props) {
  const [failed, setFailed] = useState(false);

  return (
    <figure className="mt-5 rounded-xl border overflow-hidden bg-muted/30">
      {failed ? null : (
        <Image
          src={src}
          alt={alt}
          width={900}
          height={500}
          className="w-full h-auto object-cover"
          onError={() => setFailed(true)}
        />
      )}
      {failed && (
        <div className="flex items-center justify-center h-52 bg-muted/40 text-muted-foreground text-sm gap-2">
          <AlertTriangle className="h-4 w-4 opacity-50" />
          <span>Screenshot coming soon — {label}</span>
        </div>
      )}
      <figcaption className="px-4 py-2 text-xs text-muted-foreground border-t bg-background">
        {alt}
      </figcaption>
    </figure>
  );
}
