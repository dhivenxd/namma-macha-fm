"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createContinuousShowAudio, saveLatestShow } from "../lib/latest-show";
import styles from "./studio.module.css";

const QUESTION_CLIP_MARKER = "[[QUESTION_CLIP]]";
const SCRIPT_STATUS_POLL_MS = 5_000;
const SCRIPT_WAIT_LIMIT_MS = 10 * 60_000 + 30_000;

type JsonRecord = Record<string, unknown>;
type AudioTrack = { label: string; src: string };

function isJsonRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

async function getErrorMessage(response: Response) {
  try {
    const payload: unknown = await response.json();
    if (isJsonRecord(payload) && typeof payload.error === "string") {
      const cleanupWarning =
        typeof payload.cleanupWarning === "string" ? payload.cleanupWarning : "";
      return cleanupWarning ? `${payload.error} ${cleanupWarning}` : payload.error;
    }
  } catch {
    // Use a generic message when the response is not JSON.
  }

  return `The request failed (${response.status}). Please try again.`;
}

export default function Home() {
  const router = useRouter();
  const [headline, setHeadline] = useState("");
  const [story, setStory] = useState("");
  const [script, setScript] = useState("");
  const [audioTracks, setAudioTracks] = useState<AudioTrack[]>([]);
  const [audioTrackIndex, setAudioTrackIndex] = useState(0);
  const [isGeneratingScript, setIsGeneratingScript] = useState(false);
  const [isGeneratingAudio, setIsGeneratingAudio] = useState(false);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const requestIdRef = useRef<string | null>(null);

  useEffect(() => {
    return () => {
      for (const track of audioTracks) {
        if (track.src.startsWith("blob:")) URL.revokeObjectURL(track.src);
      }
    };
  }, [audioTracks]);

  async function generateScript(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const requestId = requestIdRef.current ?? crypto.randomUUID();
    requestIdRef.current = requestId;
    setError("");
    setStatus("Starting Gemini in the background. Checking for your script…");
    setScript("");
    setAudioTracks([]);
    setAudioTrackIndex(0);
    setIsGeneratingScript(true);

    try {
      const response = await fetch("/api/script", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ headline, story, requestId }),
      });

      if (!response.ok) {
        requestIdRef.current = null;
        throw new Error(await getErrorMessage(response));
      }

      const startPayload: unknown = await response.json();
      if (!isJsonRecord(startPayload) || typeof startPayload.jobId !== "string") {
        requestIdRef.current = null;
        throw new Error("Gemini did not return a script job ID. Please try again.");
      }

      const jobId = startPayload.jobId;
      requestIdRef.current = jobId;
      const jobUrl = `/api/script?jobId=${encodeURIComponent(jobId)}`;
      const deadline = Date.now() + SCRIPT_WAIT_LIMIT_MS;
      let payload: unknown;
      let pollFailures = 0;

      while (Date.now() < deadline) {
        await new Promise((resolve) => setTimeout(resolve, SCRIPT_STATUS_POLL_MS));

        let jobResponse: Response;
        try {
          jobResponse = await fetch(jobUrl, { cache: "no-store" });
        } catch {
          pollFailures += 1;
          if (pollFailures > 3) {
            throw new Error("The connection to the app was interrupted while checking Gemini. Press Generate script again to resume this same request.");
          }
          setStatus("Gemini is still working; reconnecting to check the same job…");
          continue;
        }

        if (jobResponse.status === 202) {
          pollFailures = 0;
          setStatus("Gemini is still drafting your script…");
          continue;
        }
        if (!jobResponse.ok) {
          const responsePayload: unknown = await jobResponse.clone().json().catch(() => null);
          if (isJsonRecord(responsePayload) && responsePayload.retryable === true) {
            pollFailures += 1;
            if (pollFailures <= 3) {
              setStatus("Gemini’s status check briefly failed; reconnecting to the same draft…");
              continue;
            }
          }
          if (isJsonRecord(responsePayload) && responsePayload.terminal === true) {
            requestIdRef.current = null;
            void fetch(jobUrl, { method: "DELETE" }).catch(() => undefined);
          }
          throw new Error(await getErrorMessage(jobResponse));
        }

        pollFailures = 0;
        payload = await jobResponse.json();
        break;
      }

      if (!payload) {
        await fetch(`${jobUrl}&cancel=true`, { method: "DELETE" }).catch(() => undefined);
        requestIdRef.current = null;
        throw new Error("Gemini took too long to finish. The interaction was stopped; please try again.");
      }
      if (!isJsonRecord(payload) || typeof payload.script !== "string") {
        requestIdRef.current = null;
        throw new Error("The script response was incomplete. Please try again.");
      }

      setScript(payload.script);
      requestIdRef.current = null;
      try {
        const cleanupResponse = await fetch(jobUrl, { method: "DELETE" });
        const cleanupPayload: unknown = await cleanupResponse.json().catch(() => null);
        if (
          isJsonRecord(cleanupPayload) &&
          typeof cleanupPayload.cleanupWarning === "string"
        ) {
          setError(cleanupPayload.cleanupWarning);
        } else if (!cleanupResponse.ok) {
          setError("Script ready. Gemini could not confirm removal of its temporary interaction.");
        }
      } catch {
        setError("Script ready. Gemini could not confirm removal of its temporary interaction.");
      }
      setStatus("Script ready. Review or edit it, then generate the full broadcast audio when you’re ready.");
    } catch (requestError) {
      setStatus("");
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Script generation failed. Please try again.",
      );
    } finally {
      setIsGeneratingScript(false);
    }
  }

  async function generateAudio() {
    const text = script.trim();
    const scriptParts = text.split(QUESTION_CLIP_MARKER);
    if (
      scriptParts.length !== 2 ||
      !scriptParts[0].trim() ||
      !scriptParts[1].trim()
    ) {
      setError(`Keep ${QUESTION_CLIP_MARKER} exactly once, with narration before and after it.`);
      return;
    }

    setError("");
    setStatus("Generating two narration segments one at a time with Gnani. This can use up to two TTS requests and your quota.");
    setAudioTracks([]);
    setAudioTrackIndex(0);
    setIsGeneratingAudio(true);

    try {
      async function synthesize(textSegment: string) {
        const response = await fetch("/api/tts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: textSegment, voice: "Shubham", language: "auto" }),
        });

        if (!response.ok) {
          throw new Error(await getErrorMessage(response));
        }

        const audio = await response.blob();
        if (!audio.type.startsWith("audio/")) {
          throw new Error("Gnani returned an unexpected audio file.");
        }

        return audio;
      }

      const beforeClipAudio = await synthesize(scriptParts[0].trim());
      setStatus("The first narration segment is ready. Generating the second…");
      const afterClipAudio = await synthesize(scriptParts[1].trim());

      setStatus("Joining the intro, narration, and reaction clip into one continuous latest-show replay…");
      const [introResponse, questionClipResponse] = await Promise.all([
        fetch("/audio/intro.mp3"),
        fetch("/audio/what-are-you-people-doing.mp3"),
      ]);
      if (!introResponse.ok || !questionClipResponse.ok) {
        throw new Error("The saved intro or reaction clip could not be loaded.");
      }
      const [introAudio, questionClipAudio] = await Promise.all([
        introResponse.blob(),
        questionClipResponse.blob(),
      ]);
      const continuousShow = await createContinuousShowAudio([
        introAudio,
        beforeClipAudio,
        questionClipAudio,
        afterClipAudio,
      ]);

      try {
        await saveLatestShow(continuousShow, headline);
      } catch (saveError) {
        console.warn("The latest show could not be saved for the landing page.", saveError);
        setAudioTracks([
          { label: "Complete broadcast", src: URL.createObjectURL(continuousShow) },
        ]);
        setAudioTrackIndex(0);
        setStatus("Your full show is ready to play here. This browser could not save a replay for later.");
        return;
      }

      setStatus("Your show is ready. Opening the listening room…");
      router.push("/listen");
    } catch (requestError) {
      setStatus("");
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Audio generation failed. Please try again.",
      );
    } finally {
      setIsGeneratingAudio(false);
    }
  }

  const hasSource = Boolean(story.trim());
  const scriptParts = script.split(QUESTION_CLIP_MARKER);
  const hasValidQuestionClipCue =
    scriptParts.length === 2 &&
    Boolean(scriptParts[0].trim()) &&
    Boolean(scriptParts[1].trim());
  const activeAudioTrack = audioTracks[audioTrackIndex];

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
          <p className={styles.onAir}><span aria-hidden="true" /> The city&apos;s unpaid therapist</p>
          <nav aria-label="Main navigation" className={styles.nav}>
            <Link href="/">The station</Link>
            <Link href="/listen">Listen latest</Link>
          </nav>
        </header>

        <section aria-labelledby="page-title" className={styles.hero}>
          <div className={styles.heroCopy}>
            <p className={styles.kicker}>The Bengaluru story desk</p>
            <h1 id="page-title">Bring the chaos.<br /><em>We&apos;ll bring the mic.</em></h1>
            <p className={styles.heroDescription}>
              Gemini writes the bit. You get the final edit. Gnani turns it into one continuous Namma Macha broadcast.
            </p>
          </div>
          <aside aria-label="RJ Macha studio note" className={styles.studioNote}>
            <div className={styles.studioNoteHeader}><span className={styles.liveDot} /> LIVE FROM THE GROUP CHAT</div>
            <Image alt="" className={styles.studioAvatar} height={190} src="/images/rj-macha.png" width={190} />
            <p className={styles.studioNoteCopy}>Bring a headline.<br /><strong>Leave your civic optimism at the door.</strong></p>
            <span className={styles.studioStamp}>100% local<br />0% qualified</span>
          </aside>
        </section>

        <form className={styles.form} onSubmit={generateScript}>
          <div className={styles.sectionHeading}>
            <span className={styles.sectionTag}>Start with the source</span>
            <h2>What happened this time?</h2>
            <p>Add a headline and paste the confirmed story details. Gemini writes from the information you provide.</p>
          </div>

          <div className={styles.fields}>
            <div className={styles.field}>
              <label className={styles.label} htmlFor="headline">Headline <span>Optional</span></label>
              <input
                className={styles.input}
                disabled={isGeneratingScript}
                id="headline"
                maxLength={300}
                onChange={(event) => {
                  requestIdRef.current = null;
                  setHeadline(event.target.value);
                }}
                placeholder="The headline in one line"
                value={headline}
              />
            </div>

            <div className={`${styles.field} ${styles.fieldFull}`}>
              <label className={styles.label} htmlFor="story">Story details <span>Required</span></label>
              <textarea
                className={styles.storyInput}
                disabled={isGeneratingScript}
                id="story"
                maxLength={6000}
                onChange={(event) => {
                  requestIdRef.current = null;
                  setStory(event.target.value);
                }}
                placeholder="Paste the confirmed details here. Your source material stays in this browser while you work."
                value={story}
              />
              <p className={styles.counter}>{story.length.toLocaleString()} / 6,000</p>
            </div>
          </div>

          <button className={styles.primaryButton} disabled={!hasSource || isGeneratingScript || isGeneratingAudio} type="submit">
            {isGeneratingScript ? <><span className={styles.spinner} aria-hidden="true" /> Gemini is writing…</> : "Generate script"}
          </button>
        </form>

        {script && (
          <section aria-labelledby="script-title" className={styles.scriptPanel}>
            <div className={styles.sectionHeading}>
              <span className={styles.sectionTag}>Review before we hit record</span>
              <h2 id="script-title">Your script, your call.</h2>
              <p>Edit anything you like. Keep the question-clip marker exactly once so the real clip lands in the right place.</p>
            </div>

            <label className={styles.srOnly} htmlFor="script">Generated broadcast script</label>
            <textarea
              className={styles.scriptInput}
              id="script"
              maxLength={4000}
              onChange={(event) => {
                setScript(event.target.value);
                setAudioTracks([]);
                setAudioTrackIndex(0);
              }}
              value={script}
            />
            <div className={styles.scriptFooter}>
              <p className={styles.counter}>{script.length.toLocaleString()} / 4,000</p>
              <p className={styles.helper}>The marker is an audio cue; it will not be spoken.</p>
            </div>
            <p className={styles.markerHint}>Keep <code>{QUESTION_CLIP_MARKER}</code> exactly once, with narration before and after it.</p>

            <div className={styles.generateRow}>
              <button
                className={styles.audioButton}
                disabled={!hasValidQuestionClipCue || isGeneratingAudio || isGeneratingScript}
                onClick={generateAudio}
                type="button"
              >
                {isGeneratingAudio ? <><span className={styles.spinner} aria-hidden="true" /> Building your show…</> : "Generate the full show"}
              </button>
              <p>Intro, RJ narration, the reaction clip, then the closing line — joined into one audio file.</p>
            </div>

            {activeAudioTrack && (
              <div className={styles.fallbackPlayer}>
                <p>Replay it here while we sort out local storage:</p>
                <audio aria-label="Complete Namma Macha FM broadcast" controls src={activeAudioTrack.src} />
              </div>
            )}
          </section>
        )}

        {status && <p aria-live="polite" className={styles.status} role="status">{status}</p>}
        {error && <p aria-live="assertive" className={styles.error} role="alert">{error}</p>}

        <footer className={styles.footer}>
          <span>NAMMA MACHA FM 98.6</span>
          <span>The city has entered the chat.</span>
        </footer>
      </div>
    </main>
  );
}
