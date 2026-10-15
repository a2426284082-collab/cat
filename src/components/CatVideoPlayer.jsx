import React, { useRef, useState } from 'react';

export default function CatVideoPlayer({ url }) {
  const [proxy, setProxy] = useState(false);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const resume = useRef(null);
  const source = proxy ? `${url}${url.includes('?') ? '&' : '?'}delivery=proxy` : url;

  function recover(event) {
    if (proxy) { setFailed(true); return; }
    const player = event.currentTarget;
    resume.current = { time: player.currentTime || 0, playing: !player.paused };
    setProxy(true);
  }

  function restore(event) {
    const saved = resume.current;
    resume.current = null;
    if (!saved) return;
    const player = event.currentTarget;
    if (saved.time > 0) {
      try { player.currentTime = saved.time; } catch { /* Seeking may not be available yet. */ }
    }
    if (saved.playing) player.play().catch(() => {});
  }

  return <>
    <video key={`${source}:${attempt}`} src={source} controls playsInline preload="metadata"
      onError={recover} onLoadedMetadata={restore}
      className="w-full max-h-[78vh] bg-black rounded-xl" />
    {failed && <div role="status" className="mt-3 flex items-center justify-between gap-3 text-sm text-white">
      <span>视频暂时无法播放，请稍后重试。</span>
      <button className="shrink-0 rounded-lg bg-white/15 px-3 py-2" onClick={() => {
        resume.current = null;
        setFailed(false);
        setProxy(false);
        setAttempt(value => value + 1);
      }}>重新加载</button>
    </div>}
  </>;
}
