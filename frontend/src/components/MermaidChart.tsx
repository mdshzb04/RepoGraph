'use client';

import React, { useEffect, useRef } from 'react';
import mermaid from 'mermaid';

interface MermaidChartProps {
  chart: string;
  id?: string;
}

export default function MermaidChart({ chart, id = 'mermaid-chart' }: MermaidChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    mermaid.initialize({ startOnLoad: true, theme: 'default' });
    if (containerRef.current) {
      mermaid.contentLoaded();
    }
  }, [chart]);

  return (
    <div className="mermaid" id={id} ref={containerRef}>
      {chart}
    </div>
  );
}
