import type { Metadata } from "next";
import Link from "next/link";
import { site } from "@/lib/site";

export const metadata: Metadata = { title: "Contact", description: "Contact online2day.com about a website, web app or marketing project." };

export default function ContactPage() {
  return (
    <section className="section cream-section contact-page">
      <div className="shell contact-grid">
        <div>
          <span className="kicker dark">Contact</span>
          <h1>Bring the half-formed idea.<br /><em>We can work with that.</em></h1>
          <p className="large-copy">The fastest route for a new project is the guided brief. For everything else, email us directly.</p>
        </div>
        <div className="contact-options">
          <article><span>01</span><p>New website, app or marketing project</p><h2>Use the project wizard</h2><Link className="button button-dark" href="/start">Start brief <span>↗</span></Link></article>
          <article><span>02</span><p>General questions, partnerships or existing customers</p><h2>{site.email}</h2><a className="button button-outline-dark" href={`mailto:${site.email}`}>Send an email <span>↗</span></a></article>
        </div>
      </div>
    </section>
  );
}
