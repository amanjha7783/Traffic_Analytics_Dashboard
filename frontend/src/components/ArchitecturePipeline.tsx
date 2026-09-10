import React from 'react';

export const ArchitecturePipeline: React.FC = () => {
  const stages = [
    {
      num: 'STAGE 01',
      title: 'Traffic Video',
      tech: 'RTSP / 1080p@30fps',
      status: 'Input Ingest',
      color: 'text-primary',
    },
    {
      num: 'STAGE 02',
      title: 'Object Detection',
      tech: 'YOLOv8x / TensorRT',
      status: '12.4ms infer',
      color: 'text-primary',
    },
    {
      num: 'STAGE 03',
      title: 'Multi-Object Track',
      tech: 'ByteTrack Kalman',
      status: '38 Tracks Live',
      color: 'text-primary',
    },
    {
      num: 'STAGE 04',
      title: 'Trajectory Engine',
      tech: 'Homography & Vectors',
      status: 'X/Y World Plane',
      color: 'text-primary',
    },
    {
      num: 'STAGE 05',
      title: 'Risk Heatmap',
      tech: 'KDE Density + Decel',
      status: '4 Hotspots',
      color: 'text-amber-400',
    },
    {
      num: 'STAGE 06',
      title: 'Actionable Insights',
      tech: 'TTC • Signal Adapts',
      status: 'Real-time Stream',
      color: 'text-tertiary',
    },
  ];

  return (
    <section className="flex flex-col bg-surface-container-low rounded-xl p-space-md shadow-md gap-space-sm border border-outline-variant/10">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-space-sm">
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-primary text-[20px]">account_tree</span>
          <span className="font-headline-sm text-headline-sm font-semibold text-on-surface">
            Computer Vision Processing Architecture
          </span>
          <span className="px-2 py-0.5 rounded bg-surface-container-high font-data-mono-sm text-data-mono-sm text-tertiary border border-outline-variant/20">
            End-to-End Latency: 24ms
          </span>
        </div>
        <span className="font-label-caps text-label-caps uppercase text-on-surface-variant">
          ACADEMIC &amp; INDUSTRIAL PIPELINE SPECIFICATION
        </span>
      </div>

      {/* 6-Stage Process Flow Diagram */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2 pt-1">
        {stages.map((stg) => (
          <div
            key={stg.num}
            className="p-space-sm rounded-lg bg-surface-container flex flex-col justify-between relative group hover:bg-surface-container-high transition-colors border border-outline-variant/10"
          >
            <div className="flex items-center justify-between">
              <span className="font-label-caps text-[9px] uppercase text-primary font-bold">
                {stg.num}
              </span>
              <span className="w-1.5 h-1.5 rounded-full bg-tertiary"></span>
            </div>
            <div className="my-2 flex flex-col">
              <span className="font-headline-sm text-[13px] font-bold text-on-surface leading-tight">
                {stg.title}
              </span>
              <span className="font-data-mono-sm text-[10px] text-on-surface-variant mt-0.5">
                {stg.tech}
              </span>
            </div>
            <div className={`font-data-mono-sm text-[10px] font-medium ${stg.color}`}>
              {stg.status}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
};
