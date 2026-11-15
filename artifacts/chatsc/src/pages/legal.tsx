import type { ReactNode } from "react";
import { Link } from "wouter";

function Doc({ kicker, title, children }: { kicker: string; title: string; children: ReactNode }) {
  return (
    <article className="max-w-3xl mx-auto px-4 pt-10 md:pt-14 rise">
      <p className="font-mono text-xs uppercase tracking-[0.2em] text-primary">{kicker}</p>
      <h1 className="font-display text-4xl md:text-5xl font-extrabold mt-2">{title}</h1>
      <div role="note" className="mt-6 rounded-2xl border-2 border-accent bg-accent/20 p-4 text-sm" data-testid="text-legal-draft">
        <strong>Draft for review.</strong> This is a plain-language draft describing how ChatSC currently works. The operator must review, adapt, and publish approved legal text before launch. It is not legal advice.
      </div>
      <div className="prose prose-stone max-w-none mt-8 prose-headings:font-display prose-a:text-primary">{children}</div>
    </article>
  );
}

export function PrivacyPage() {
  return (
    <Doc kicker="Draft" title="Privacy Policy">
      <p>ChatSC is an independent student guide, not an official USC service. This page explains what we collect and why.</p>
      <h2>What onboarding stores</h2>
      <ul>
        <li>Your first name, email address, and US phone number. Email and phone verification are not currently active; typed contact details are not marked verified.</li>
        <li>Goals, topics, recommendation frequency, classes, and schedule blocks you choose to share.</li>
        <li>Your choice to request Gmail personalization.</li>
      </ul>
      <p>Your profile is stored privately on our server and is not publicly listed. Schedule uploads (.ics, PDF, or image) are read in your browser and are not uploaded or retained; extracted class blocks are shown for you to review and saved only if you finish onboarding.</p>
      <h2>Gmail access</h2>
      <p>You may indicate that you want Gmail personalization. This preference is not itself Google's permission to read mail. Gmail is not connected in this version; no messages are read. If enabled later, access should begin only after a separate Google permission screen, and the final policy must describe exactly what data is accessed, used, and retained.</p>
      <p>Contact verification is not active in this preview, so the site does not claim that typed email addresses or phone numbers belong to the person who entered them.</p>
      <h2>Cookies</h2>
      <p>We use a browser cookie to recognize your session and keep your preferences with this browser. Contact details are not stored in local storage or in page URLs.</p>
      <h2>Messages</h2>
      <p>ChatSC does not send text messages or automated recommendations in this version.</p>
      <h2>What we do not do</h2>
      <p>We do not sell your information. We do not promise any specific response time, deletion process, or support contact beyond what the operator publishes in the final version of this policy.</p>
      <p>See also our <Link href="/terms">Terms</Link>.</p>
    </Doc>
  );
}

export function TermsPage() {
  return (
    <Doc kicker="Draft" title="Terms">
      <p>By using ChatSC, you agree to these terms.</p>
      <h2>What ChatSC is</h2>
      <p>ChatSC is an independent guide for USC students. It is not affiliated with or endorsed by the University of Southern California. Listings may be incomplete or out of date, and some are clearly labeled Sample. Always confirm details with the organizer.</p>
      <h2>Recommendations</h2>
      <p>Your selected recommendation frequency is saved as a preference. ChatSC does not send automated messages in this version.</p>
      <h2>Schedule uploads</h2>
      <p>Calendar files, PDFs, and images are parsed locally in your browser. The extracted weekly class blocks are suggestions: review them for accuracy before saving. The original upload is not sent to the service.</p>
      <h2>Fair use</h2>
      <p>Do not misuse the service, sign up someone else's number, or try to access data that is not yours.</p>
      <h2>No guarantees</h2>
      <p>The service is provided as is, without guarantees of availability or accuracy.</p>
      <p>See also our <Link href="/privacy">Privacy Policy</Link>.</p>
    </Doc>
  );
}
