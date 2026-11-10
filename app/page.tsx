import Link from "next/link";
import Image from "next/image";
import LatestShowPlayer from "./components/latest-show-player";
import styles from "./landing.module.css";

const broadcastLinks = [
  {
    number: "01",
    label: "THE CITY",
    description: "Where ‘10 minutes away’ is a legally protected fiction.",
  },
  {
    number: "02",
    label: "THE HOST",
    description: "RJ Macha: professionally unqualified, spiritually on air.",
  },
  {
    number: "03",
    label: "THE FREQUENCY",
    description: "Bengaluru’s civic chaos, remixed for the commute.",
  },
];

export default function Home() {
  return (
    <main className={styles.page} id="top">
      <header className={styles.header}>
        <Link aria-label="Namma Macha FM home" className={styles.brand} href="/">
          <Image
            alt=""
            className={styles.brandAvatar}
            height={54}
            priority
            src="/images/rj-macha.png"
            width={54}
          />
          <span className={styles.brandText}>
            <span className={styles.brandName}>Namma Macha</span>
            <span className={styles.brandDetail}>FM 98.6 · Bengaluru</span>
          </span>
        </Link>

        <p className={styles.onAir}><span aria-hidden="true" /> City&apos;s unpaid therapist</p>

        <nav aria-label="Main navigation" className={styles.nav}>
          <a href="#sound">The sound of the city</a>
          <a href="#latest">Latest show</a>
          <Link href="/broadcast">Script a show</Link>
          <Link className={styles.navCta} href="/listen">Listening room <span aria-hidden="true">↗</span></Link>
        </nav>
      </header>

      <section aria-labelledby="hero-title" className={styles.hero}>
        <div className={styles.heroCopy}>
          <p className={styles.kicker}>Civic chaos <span aria-hidden="true">·</span> now in stereo</p>
          <h1 id="hero-title">City&apos;s a mess. <span className={styles.heroAccent}>Macha&apos;s on mic.</span></h1>
          <p className={styles.heroDescription}>
            Bengaluru&apos;s breaking news, dark punchlines, and group-chat energy for your commute.
          </p>
          <div className={styles.heroActions}>
            <a className={styles.primaryAction} href="#latest">Play the latest meltdown</a>
          </div>
          <p className={styles.frequencyNote}>98.6 FM <span aria-hidden="true">·</span> customer care for civic crisis</p>
        </div>

        <div aria-label="A spinning vinyl record tuned to Namma Macha FM 98.6, with RJ Macha on air" className={styles.tuner} role="img">
          <div className={styles.tunerTopline}>
            <span className={styles.liveDot} /> NO ADULTS ON DUTY <span aria-hidden="true">·</span> 98.6 FM
          </div>
          <div aria-hidden="true" className={styles.waveBars}>
            {Array.from({ length: 18 }, (_, index) => <span key={`wave-${index}`} />)}
          </div>
          <div aria-hidden="true" className={styles.record}>
            <div className={styles.recordGrooves} />
            <div className={styles.recordLabel}>
              <span>98.6</span>
              <small>SIDE A</small>
            </div>
          </div>
          <div aria-hidden="true" className={styles.mascotSticker}>
            <Image alt="" className={styles.mascotImage} height={148} src="/images/rj-macha.png" width={148} />
            <span className={styles.mascotCaption}>RJ MACHA<br />LIVE FROM THE GROUP CHAT</span>
          </div>
          <span aria-hidden="true" className={styles.tunerSticker}>100% local<br />0% qualified</span>
          <p aria-hidden="true" className={styles.tunerSignoff}>Bengaluru&apos;s civic breakdown, remixed.</p>
        </div>
      </section>

      <section aria-labelledby="latest-title" className={styles.latest} id="latest">
        <div className={styles.latestIntro}>
          <p className={styles.kicker}>Fresh off the frequency</p>
          <h2 id="latest-title">The city&apos;s latest crash-out.</h2>
          <p>One continuous listen. Zero tab switching. Full-length municipal coping.</p>
        </div>
        <LatestShowPlayer />
      </section>

      <section aria-labelledby="sound-title" className={styles.sound} id="sound">
        <div className={styles.soundHeading}>
          <p className={styles.kicker}>Our very serious nonsense</p>
          <h2 id="sound-title">Civic chaos. Locally sourced.</h2>
        </div>
        <div className={styles.soundColumns}>
          {broadcastLinks.map((item) => (
            <article className={styles.soundItem} key={item.number}>
              <span className={styles.soundNumber}>{item.number}</span>
              <div>
                <h3>{item.label}</h3>
                <p>{item.description}</p>
              </div>
            </article>
          ))}
        </div>
      </section>

      <footer className={styles.footer}>
        <Link aria-label="Namma Macha FM home" className={styles.footerBrand} href="/">
          <Image alt="" className={styles.footerAvatar} height={38} src="/images/rj-macha.png" width={38} />
          <span className={styles.footerBrandText}>
            <span>Namma Macha FM</span>
            <span>Bengaluru, 98.6</span>
          </span>
        </Link>
        <p>Bengaluru, sorted by absolutely no one.</p>
        <a className={styles.footerCta} href="#latest">Play the latest show <span aria-hidden="true">↗</span></a>
      </footer>
    </main>
  );
}
