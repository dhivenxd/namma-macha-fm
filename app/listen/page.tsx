"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { loadLatestShow, type LatestShow } from "../lib/latest-show";
import styles from "./listen.module.css";

function formatTime(seconds: number) {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.floor(seconds % 60).toString().padStart(2, "0");
  return `${minutes}:${remainingSeconds}`;
}

export default function ListenPage() {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [show, setShow] = useState<LatestShow | null>(null);
  const [audioUrl, setAudioUrl] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isPlaying, setIsPlaying] = useState(false);
  const [canPlay, setCanPlay] = useState(false);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [loadError, setLoadError] = useState("");
  const [playerError, setPlayerError] = useState("");

  useEffect(() => {
    let cancelled = false;
    let objectUrl = "";

    void loadLatestShow()
      .then((latestShow) => {
        if (cancelled || !latestShow) return;
        objectUrl = URL.createObjectURL(latestShow.audio);
        setShow(latestShow);
        setAudioUrl(objectUrl);
      })
      .catch(() => {
        if (!cancelled) setLoadError("This browser couldn't open its saved broadcast. Return to the studio and make a fresh one.");
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
        setPlayerError("Playback didn't start. Give play another tap.");
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

  const createdLabel = show
    ? new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric" }).format(show.createdAt)
    : "";
  const downloadName = show?.title.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "") || "namma-macha-broadcast";

  return (
    <main className={styles.page}>
      <div className={styles.shell}>
        <header className={styles.header}>
          <Link aria-label="Namma Macha FM home" className={styles.brand} href="/">
            <Image alt="" className={styles.brandAvatar} height={54} src="/images/rj-macha.png" width={54} />
            <span className={styles.brandText}>
              <span className={styles.brandName}>Namma Macha</span>
              <span className={styles.brandDetail}>FM 98.6 · Bengaluru</span>
            </span>
          </Link>
          <p className={styles.onAir}><span className={styles.liveDot} aria-hidden="true" /> Your city, in stereo</p>
          <nav aria-label="Main navigation" className={styles.nav}>
            <Link href="/">The station</Link>
            <Link href="/broadcast">Back to the studio</Link>
          </nav>
        </header>

        <section aria-labelledby="listen-title" className={styles.hero}>
          <div className={styles.heroCopy}>
            <p className={styles.kicker}><span className={styles.liveDot} aria-hidden="true" /> The listening room</p>
            <h1 id="listen-title">Bengaluru&apos;s business.<br /><em>Your headphones.</em></h1>
            <p className={styles.heroDescription}>The latest local meltdown, produced by you and delivered in one continuous Namma Macha broadcast.</p>
          </div>
          <aside className={styles.stationNote}>
            <span>A quick station update</span>
            Traffic has entered the chat. It has been typing for 47 minutes.
          </aside>
        </section>

        {isLoading ? (
          <section aria-live="polite" className={styles.loading} role="status">Tuning in to your latest frequency…</section>
        ) : (
          <>
            <section aria-labelledby="show-title" className={styles.player}>
              <div className={styles.playerCopy}>
                <div aria-live="polite" className={`${styles.playerStatus} ${isPlaying ? styles.playerStatusPlaying : ""}`} role="status">
                  <span className={styles.liveDot} aria-hidden="true" />
                  {isPlaying ? "NOW PLAYING" : show ? canPlay ? "READY WHEN YOU ARE" : "LOADING THE SHOW" : "WAITING FOR YOUR FIRST SHOW"}
                </div>
                <p className={styles.showDate}>
                  {show ? <>{createdLabel} <span aria-hidden="true">·</span> 98.6 FM</> : "98.6 FM · PLAYER ON STANDBY"}
                </p>
                <h2 id="show-title">{show?.title ?? "The mic is idle. The city isn’t."}</h2>
                <p className={styles.playerDescription}>
                  {show
                    ? "Four familiar ingredients, one uninterrupted file. Bengaluru’s still doing the same thing outside."
                    : loadError || "Your next show will land here as one continuous broadcast, ready to play when you are."}
                </p>

                {show && audioUrl && (
                  <audio
                    aria-hidden="true"
                    onCanPlay={() => setCanPlay(true)}
                    onDurationChange={(event) => {
                      const nextDuration = event.currentTarget.duration;
                      setDuration(Number.isFinite(nextDuration) ? nextDuration : 0);
                    }}
                    onEnded={() => setIsPlaying(false)}
                    onError={() => setPlayerError("This audio file couldn’t be read. Generate the show again from the studio.")}
                    onPause={() => setIsPlaying(false)}
                    onPlay={() => setIsPlaying(true)}
                    onTimeUpdate={(event) => setCurrentTime(event.currentTarget.currentTime)}
                    preload="metadata"
                    ref={audioRef}
                    src={audioUrl}
                    tabIndex={-1}
                  />
                )}

                <div className={styles.playbackControls}>
                  <button
                    aria-label={show ? isPlaying ? "Pause latest broadcast" : "Play latest broadcast" : "No broadcast available to play"}
                    className={styles.playButton}
                    disabled={!canPlay}
                    onClick={togglePlayback}
                    type="button"
                  >
                    <span aria-hidden="true">{isPlaying ? "Ⅱ" : "▶"}</span>
                  </button>
                  <div className={styles.timeline}>
                    <label className={styles.srOnly} htmlFor="listen-seek">Seek through the latest broadcast</label>
                    <input
                      className={styles.seek}
                      disabled={!canPlay || !duration}
                      id="listen-seek"
                      max={duration || 0}
                      min={0}
                      onChange={seek}
                      step={0.1}
                      type="range"
                      value={Math.min(currentTime, duration || 0)}
                    />
                    <div className={styles.time} aria-live="off">
                      <span>{formatTime(currentTime)}</span>
                      <span>{formatTime(duration)}</span>
                    </div>
                  </div>
                </div>
                {playerError && <p aria-live="polite" className={styles.playerError} role="status">{playerError}</p>}
                {show && audioUrl ? (
                  <a className={styles.downloadLink} download={`${downloadName}.wav`} href={audioUrl}>Save this episode</a>
                ) : (
                  <Link className={styles.emptyAction} href="/broadcast">Go to the broadcast desk</Link>
                )}
              </div>

              <div className={styles.recordStage} aria-label="Animated Namma Macha FM vinyl record with RJ Macha" role="img">
                <div className={`${styles.record} ${isPlaying ? styles.recordPlaying : ""}`}>
                  <div className={styles.recordLabel}><strong>98.6</strong><span>NAMMA MACHA FM</span></div>
                </div>
                <span className={`${styles.toneArm} ${isPlaying ? styles.toneArmPlaying : ""}`} aria-hidden="true" />
                <div aria-hidden="true" className={`${styles.soundBars} ${isPlaying ? styles.soundBarsPlaying : ""}`}>
                  {Array.from({ length: 13 }, (_, index) => <span key={`signal-${index}`} />)}
                </div>
                <Image alt="" className={styles.mascot} height={225} src="/images/rj-macha.png" width={190} />
                <span className={styles.recordCaption}>LIVE FROM<br />THE GROUP CHAT</span>
              </div>
            </section>

            <div className={styles.jokeStrip}>
              <p>One continuous listen. Traffic still needs four segments to cross one signal.</p>
              <span>Still Bengaluru, unfortunately</span>
            </div>

            <section aria-label="Broadcast ingredients" className={styles.reelInfo}>
              <div className={styles.reelHeading}>
                <span>On this frequency</span>
                <h3>From intro to aftermath, in order.</h3>
              </div>
              <div className={styles.segments}>
                <span>Intro clip</span><span>RJ Macha</span><span>Reaction clip</span><span>Sign-off</span>
              </div>
            </section>
          </>
        )}

        <footer className={styles.footer}>
          <span>NAMMA MACHA FM 98.6 · BENGALURU AFTER HOURS</span>
          <div className={styles.footerLinks}><Link href="/">Home</Link><Link href="/broadcast">Make another show</Link></div>
        </footer>
      </div>
    </main>
  );
}
