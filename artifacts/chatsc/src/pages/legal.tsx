import type { ReactNode } from "react";
import { Link } from "wouter";

function Doc({ kicker, title, children }: { kicker: string; title: string; children: ReactNode }) {
  return (
    <article className="max-w-3xl mx-auto px-4 pt-10 md:pt-14 rise">
      <p className="font-mono text-xs uppercase tracking-[0.2em] text-primary">{kicker}</p>
      <h1 className="font-display text-4xl md:text-5xl font-extrabold mt-2">{title}</h1>
      <div role="note" className="mt-6 rounded-2xl border-2 border-accent bg-accent/20 p-4 text-sm" data-testid="text-legal-draft">
        <strong>Draft for review.</strong> This is a plain-language draft describing how ChatSC and Toji currently work. The operator must review, adapt, and publish approved legal text before launch. It is not legal advice.
      </div>
      <div className="prose prose-stone max-w-none mt-8 prose-headings:font-display prose-a:text-primary">{children}</div>
    </article>
  );
}

export function PrivacyPage() {
  return (
    <Doc kicker="Draft" title="Privacy Policy">
      <p>ChatSC is an independent student guide, not an official USC service. This page explains what we collect and why.</p>
      <h2>What we collect when you sign up for Toji</h2>
      <ul>
        <li>Your first name and US phone number.</li>
        <li>Interests and classes you choose to share (optional).</li>
        <li>Your consent to receive texts, the consent wording you agreed to, and when you agreed.</li>
      </ul>
      <p>Signup records and phone numbers are stored privately on our server and are not publicly listed on the website. Your own name and interests may appear in your browser's preferences. A separate messaging bot run by the operator can retrieve new signups through a protected connection so it can text you.</p>
      <h2>Cookies</h2>
      <p>We use a browser cookie to recognize your session, so your preferences and Toji chat can be linked to your signup on this browser. We do not store your phone number in your browser's local storage or in page URLs.</p>
      <h2>Website chat</h2>
      <p>Messages you send in the on-site chat are passed to the AI agent the operator has configured. In this site, the conversation is held only in the open page and disappears when you reload. When no agent is connected, you get a placeholder reply instead. The connected agent may keep its own records according to how the operator sets it up.</p>
      <h2>Texts</h2>
      <p>Automatic text sending is not active yet. Once the messaging bot is connected, you can reply STOP at any time and the bot will handle your opt-out.</p>
      <h2>What we do not do</h2>
      <p>We do not sell your information. We do not promise any specific response time, deletion process, or support contact beyond what the operator publishes in the final version of this policy.</p>
      <p>See also our <Link href="/terms">Terms</Link>.</p>
    </Doc>
  );
}

export function TermsPage() {
  return (
    <Doc kicker="Draft" title="Terms">
      <p>By using ChatSC or signing up for Toji, you agree to these terms.</p>
      <h2>What ChatSC is</h2>
      <p>ChatSC is an independent guide for USC students. It is not affiliated with or endorsed by the University of Southern California. Listings may be incomplete or out of date, and some are clearly labeled Sample. Always confirm details with the organizer.</p>
      <h2>Toji texts</h2>
      <p>If you check the consent box, you agree to receive iMessage or text messages from Toji with recommendations about clubs, events, and opportunities. Texting is not active yet; it starts only after the operator connects the messaging bot. Reply STOP anytime to unsubscribe once it is live. Message and data rates may apply.</p>
      <h2>AI replies</h2>
      <p>Toji's replies are generated automatically and can be wrong. Until the agent is connected, chat replies are placeholders and are not real recommendations. Do not share sensitive personal information in chat.</p>
      <h2>Fair use</h2>
      <p>Do not misuse the service, sign up someone else's number, or try to access data that is not yours.</p>
      <h2>No guarantees</h2>
      <p>The service is provided as is, without guarantees of availability or accuracy.</p>
      <p>See also our <Link href="/privacy">Privacy Policy</Link>.</p>
    </Doc>
  );
}
