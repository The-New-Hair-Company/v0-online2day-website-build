import Link from "next/link";
import { site } from "@/lib/site";

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="shell footer-cta">
        <div>
          <span className="kicker">Have an idea?</span>
          <h2>Make it real.<br /><em>Make it useful.</em></h2>
        </div>
        <Link href="/start" className="button button-coral">Tell us what you need <span>↗</span></Link>
      </div>
      <div className="shell footer-grid">
        <div>
          <Link className="brand footer-brand" href="/">
            <img className="brand-mark" src="/mark.svg" alt="" width="34" height="34" aria-hidden="true" />
            <span>online<span>2</span>day.com</span>
          </Link>
          <p>Useful digital work, priced clearly and built to last.</p>
        </div>
        <div>
          <h3>Explore</h3>
          <Link href="/pricing">Pricing</Link>
          <Link href="/marketing">Marketing</Link>
          <Link href="/about">About</Link>
          <Link href="/contact">Contact</Link>
        </div>
        <div>
          <h3>Legal</h3>
          <Link href="/terms">Terms & conditions</Link>
          <Link href="/privacy">Privacy policy</Link>
          <Link href="/complaints">Complaints charter</Link>
        </div>
        <div>
          <h3>Say hello</h3>
          <a href={`mailto:${site.email}`}>{site.email}</a>
          <p>UK-based · working globally</p>
        </div>
      </div>
      <div className="shell footer-bottom">
        <span>© {new Date().getFullYear()} online2day.com</span>
        <span>Built with care, not templates.</span>
      </div>
    </footer>
  );
}
