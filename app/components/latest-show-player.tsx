"use client";

import { useEffect, useRef, useState, type ChangeEvent } from "react";
import Image from "next/image";
import Link from "next/link";
import { loadLatestShow, type LatestShow } from "../lib/latest-show";

function formatTime(seconds: number) {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.floor(seconds % 60).toString().padStart(2, "0");
  return `${minutes}:${remainingSeconds}`;
}

export default function LatestShowPlayer() {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [latestShow, setLatestShow] = useState<LatestShow | null>(null);
  const [audioUrl, setAudioUrl] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isPlaying, setIsPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [playerError, setPlayerError] = useState("");

  useEffect(() => {
    let cancelled = false;
    let objectUrl = "";

    void loadLatestShow()
      .then((show) => {
        if (cancelled || !show) return;
        objectUrl = URL.createObjectURL(show.audio);
        setLatestShow(show);
        setAudioUrl(objectUrl);
      })
      .catch(() => {
        if (!cancelled) setPlayerError("The latest show could not be loaded from this browser.");
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, []);

  async function togglePlayback() {
    const audio = audioRef.current;
    if (!audio) return;

    setPlayerError("");
    if (audio.paused) {
      try {
        await audio.play();
      } catch {
        setPlayerError("Playback could not start. Try pressing play again.");
      }
    } else {
      audio.pause();
    }
  }

  function seek(event: ChangeEvent<HTMLInputElement>) {
    const audio = audioRef.current;
    if (!audio) return;
    const nextTime = Number(event.target.value);
    audio.currentTime = nextTime;
    setCurrentTime(nextTime);
  }

  const showDate = latestShow
    ? new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric" })
        .format(latestShow.createdAt)
    : "";

  return (
    <div className="latest-player">
      {audioUrl && (
        <audio
          aria-hidden="true"
          onDurationChange={(event) => setDuration(event.currentTarget.duration)}
          onEnded={() => setIsPlaying(false)}
          onPause={() => setIsPlaying(false)}
          onPlay={() => setIsPlaying(true)}
          onTimeUpdate={(event) => setCurrentTime(event.currentTarget.currentTime)}
          preload="metadata"
          ref={audioRef}
          src={audioUrl}
          tabIndex={-1}
        />
      )}

      <div className="latest-player__art" aria-hidden="true">
        <Image alt="" className="latest-player__avatar" height={92} src="/images/rj-macha.png" width={92} />
      </div>

      <div className="latest-player__body">
        <div className="latest-player__meta">
          <span className="eyebrow">{latestShow ? "LATEST BROADCAST" : "THE LATEST FREQUENCY"}</span>
          {showDate && <span className="latest-player__date">{showDate}</span>}
        </div>

        {latestShow ? (
          <>
            <h3 className="latest-player__title">{latestShow.title}</h3>
            <p className="latest-player__subtitle">Bengaluru&apos;s civic breakdown, currently on repeat.</p>
            <div className="latest-player__controls">
              <button
                aria-label={isPlaying ? "Pause latest broadcast" : "Play latest broadcast"}
                className="latest-player__play"
                onClick={togglePlayback}
                type="button"
              >
                <span aria-hidden="true">{isPlaying ? "Ⅱ" : "▶"}</span>
              </button>
              <div className="latest-player__timeline">
                <label className="sr-only" htmlFor="latest-show-seek">Seek through the latest broadcast</label>
                <input
                  className="latest-player__seek"
                  disabled={!duration}
                  id="latest-show-seek"
                  max={duration || 0}
                  min={0}
                  onChange={seek}
                  step={0.1}
                  type="range"
                  value={Math.min(currentTime, duration || 0)}
                />
                <div className="latest-player__time" aria-live="off">
                  <span>{formatTime(currentTime)}</span>
                  <span>{formatTime(duration)}</span>
                </div>
              </div>
            </div>
            <Link className="text-link" href="/listen">OPEN THE LISTENING ROOM <span aria-hidden="true">↗</span></Link>
          </>
        ) : (
          <>
            <h3 className="latest-player__title">
              {isLoading ? "Checking the feed before we blame the algorithm…" : "The mic is idle. The city isn’t."}
            </h3>
            <p className="latest-player__subtitle">
              {isLoading
                ? "Checking this browser for your saved broadcast."
                : "Your next show drops here in one continuous listen."}
            </p>
            {!isLoading && <Link className="text-link" href="/listen">OPEN THE LISTENING ROOM <span aria-hidden="true">↗</span></Link>}
          </>
        )}

        {playerError && <p className="latest-player__error" role="status">{playerError}</p>}
      </div>
    </div>
  );
}
