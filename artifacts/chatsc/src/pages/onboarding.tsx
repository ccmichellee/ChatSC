import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { useLocation, Link } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, ArrowRight, Check, FileUp, Mail, ShieldCheck, Smartphone } from "lucide-react";
import { useGetProfile, useSaveOnboarding, getGetProfileQueryKey, type ClassBlock, type StudentInputFrequency } from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";
import { ClassBlockEditor } from "@/components/class-blocks";
import { blockOverlaps } from "@/lib/campus";

const GOALS = [
  "Find a club or community", "Build projects and gain experience",
  "Explore internships and jobs", "Find research opportunities",
  "Meet people in my field", "Discover free campus events",
  "Volunteer or make an impact", "Grow creative skills",
];
const TOPICS = [
  "AI and data", "Engineering and design", "Business and startups",
  "Arts and media", "Health and wellness", "Public service",
  "Sustainability", "Film and performance",
];
const FREQ: { v: StudentInputFrequency; label: string; sub: string }[] = [
  { v: "daily", label: "Every day", sub: "A short daily roundup" },
  { v: "twice-weekly", label: "Twice a week", sub: "A midweek and weekend update" },
  { v: "weekly", label: "Once a week", sub: "One weekly roundup" },
];
const inp = "h-12 w-full rounded-xl bg-background border-2 border-input px-4 text-base focus:outline-none focus:ring-2 focus:ring-primary/40";

function validUsPhone(value: string) {
  if (!/^[0-9\s()+.\-]*$/.test(value)) return false;
  let digits = value.replace(/\D/g, "");
  if (digits.length === 11 && digits.startsWith("1")) digits = digits.slice(1);
  return digits.length === 10 && /^[2-9]/.test(digits) && /^[2-9]/.test(digits[3]);
}

function ChoiceGroup({ title, subtitle, choices, value, onToggle, testId }: {
  title: string; subtitle: string; choices: string[]; value: string[]; onToggle: (item: string) => void; testId: string;
}) {
  return (
    <fieldset>
      <legend className="font-display text-xl font-bold">{title}</legend>
      <p className="text-sm text-muted-foreground mt-1">{subtitle}</p>
      <div className="grid sm:grid-cols-2 gap-2 mt-4">
        {choices.map((item) => {
          const selected = value.includes(item);
          return <button key={item} type="button" aria-pressed={selected} onClick={() => onToggle(item)}
            data-testid={`${testId}-${item.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`}
            className={`min-h-12 text-left rounded-xl border-2 px-4 py-2.5 text-sm font-semibold transition-colors ${selected ? "border-primary bg-primary/10 text-foreground" : "border-border bg-background hover:border-primary/60"}`}>
            <span className="mr-2 inline-grid h-5 w-5 align-middle place-items-center rounded-md border border-current">
              {selected && <Check size={14} className="text-primary" />}
            </span>{item}
          </button>;
        })}
      </div>
    </fieldset>
  );
}

export default function Onboarding() {
  const [, nav] = useLocation();
  const qc = useQueryClient();
  const { toast } = useToast();
  const profile = useGetProfile();
  const save = useSaveOnboarding();
  const [step, setStep] = useState(0);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [interests, setInterests] = useState<string[]>([]);
  const [goals, setGoals] = useState<string[]>([]);
  const [notes, setNotes] = useState("");
  const [blocks, setBlocks] = useState<ClassBlock[]>([]);
  const [freq, setFreq] = useState<StudentInputFrequency>("weekly");
  const [gmailConsent, setGmailConsent] = useState(false);
  const [importStatus, setImportStatus] = useState("");
  const [importing, setImporting] = useState(false);
  const [basicsAttempted, setBasicsAttempted] = useState(false);
  const inited = useRef(false);
  useEffect(() => {
    const p = profile.data;
    if (p && !inited.current) {
      inited.current = true;
      setName(p.name === "Trojan" ? "" : p.name);
      setEmail(p.email ?? "");
      setInterests(p.interests ?? []);
      setGoals(p.goals ?? []);
      setNotes(p.notes ?? "");
      setBlocks(p.availability ?? []);
      setGmailConsent(p.gmail_consent ?? false);
      if (p.frequency === "daily" || p.frequency === "weekly" || p.frequency === "twice-weekly") setFreq(p.frequency);
    }
  }, [profile.data]);

  const nameOk = Boolean(name.trim());
  const emailValue = email.trim().toLowerCase();
  const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailValue);
  const phoneOk = (profile.data?.onboarded && !phone.trim()) || validUsPhone(phone);
  const blocksOk = blockOverlaps(blocks).size === 0 && !blocks.some((b) => b.end <= b.start);
  const goNext = () => {
    if (step === 0 && (!nameOk || !emailOk || !phoneOk)) {
      setBasicsAttempted(true);
      const firstInvalid = !nameOk ? "name" : !emailOk ? "email" : "phone";
      requestAnimationFrame(() => document.getElementById(firstInvalid)?.focus());
      return;
    }
    setStep((current) => Math.min(3, current + 1));
  };
  const toggle = (value: string[], setter: (items: string[]) => void, item: string) =>
    setter(value.includes(item) ? value.filter((x) => x !== item) : [...value, item]);

  const handleFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setImporting(true);
    setImportStatus("Reading your schedule in this browser… the file isn't uploaded or saved.");
    try {
      const { importScheduleFile } = await import("@/lib/schedule-import");
      const parsed = await importScheduleFile(file, setImportStatus);
      if (!parsed.length) {
        setImportStatus("I couldn't confirm class times in this file. Nothing was saved; you can add classes below.");
      } else {
        setBlocks((previous) => {
          const merged = new Map(previous.map((b) => [`${b.day}:${b.start}:${b.end}:${b.title}`, b]));
          for (const b of parsed) merged.set(`${b.day}:${b.start}:${b.end}:${b.title}`, b);
          return [...merged.values()].slice(0, 40);
        });
        setImportStatus(`Found ${parsed.length} class blocks. Review and edit them below before saving.`);
      }
    } catch (error) {
      setImportStatus(error instanceof Error ? error.message : "Couldn't read that file. You can add your classes below.");
    } finally {
      setImporting(false);
    }
  };

  const finish = () => {
    if (!name.trim() || !emailOk || !phoneOk || !blocksOk) return;
    save.mutate({ data: {
      phone, email: emailValue, interests, goals, notes: notes.trim(),
      gmail_consent: gmailConsent, availability: blocks, frequency: freq,
      name: name.trim().slice(0, 100),
    } }, {
      onSuccess: (p) => {
        qc.setQueryData(getGetProfileQueryKey(), p);
        qc.invalidateQueries({ queryKey: getGetProfileQueryKey() });
        qc.invalidateQueries({ queryKey: ["/api/recommendations"] });
        qc.invalidateQueries({ queryKey: ["/api/events"] });
        toast({ title: "Preferences saved", description: "You can update them anytime." });
        nav("/");
      },
      onError: () => toast({ title: "Couldn't save your onboarding", description: "Please check the fields and try again.", variant: "destructive" }),
    });
  };

  const steps = ["About you", "What you want", "Schedule & Gmail", "Recommendations"];
  return (
    <div className="max-w-2xl mx-auto px-4 py-8 md:py-12">
      <div className="mb-6">
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-primary">ChatSC onboarding</p>
        <h1 className="font-display text-3xl md:text-4xl font-extrabold mt-2">Make campus fit your plans.</h1>
        <p className="text-muted-foreground mt-2">A few details help us find opportunities worth your time.</p>
      </div>
      <ol className="flex gap-2 mb-6" aria-label="Onboarding progress">
        {steps.map((label, i) => (
          <li key={label} className="flex-1" aria-current={i === step ? "step" : undefined}>
            <div className={`h-1.5 rounded-full transition-colors ${i <= step ? "bg-primary" : "bg-border"}`} />
            <p className={`mt-2 font-mono text-[9px] sm:text-[11px] uppercase tracking-wider ${i === step ? "text-primary" : "text-muted-foreground"}`}>{i + 1}. {label}</p>
          </li>
        ))}
      </ol>
      <div key={step} className="rise rounded-[2rem] bg-card border border-card-border p-5 sm:p-7 md:p-8">
        {step === 0 && <>
          <h2 className="font-display text-2xl font-extrabold">First, the basics.</h2>
          <p className="text-muted-foreground mt-1">
            {profile.data?.onboarded
              ? "Enter your name and a valid email to continue. Leave mobile blank to keep your existing number."
              : "Enter your name, a valid email, and a 10-digit U.S. mobile number to continue."} Verification isn’t available in this preview.
          </p>
          <label className="block mt-5 text-sm font-semibold" htmlFor="name">First name <span aria-hidden="true" className="text-primary">*</span></label>
          <input id="name" required value={name} onChange={(e) => setName(e.target.value)} maxLength={100} autoComplete="given-name" className={`${inp} mt-1`} placeholder="Your first name" aria-invalid={basicsAttempted && !nameOk} aria-describedby={basicsAttempted && !nameOk ? "name-error" : undefined} data-testid="input-name" />
          {basicsAttempted && !nameOk && <p id="name-error" role="alert" className="mt-1 text-xs text-destructive">Enter your first name to continue.</p>}
          <label className="block mt-4 text-sm font-semibold" htmlFor="email">USC or preferred email <span aria-hidden="true" className="text-primary">*</span></label>
          <input id="email" required type="email" autoComplete="email" inputMode="email" value={email} onChange={(e) => setEmail(e.target.value)} maxLength={254} className={`${inp} mt-1`} placeholder="you@example.com" aria-invalid={basicsAttempted && !emailOk} aria-describedby={basicsAttempted && !emailOk ? "email-error" : undefined} data-testid="input-email" />
          <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground"><Mail size={14} /> Email code verification isn't connected; this address remains unverified.</div>
          {basicsAttempted && !emailOk && <p id="email-error" role="alert" className="mt-1 text-xs text-destructive">Enter a valid email address to continue.</p>}
          <label className="block mt-4 text-sm font-semibold" htmlFor="phone">Mobile number {!profile.data?.onboarded && <span aria-hidden="true" className="text-primary">*</span>}</label>
          <input id="phone" required={!profile.data?.onboarded} type="tel" inputMode="tel" autoComplete="tel" value={phone} onChange={(e) => setPhone(e.target.value)} className={`${inp} mt-1`} placeholder="(213) 555-0147" aria-invalid={basicsAttempted && !phoneOk} aria-describedby={basicsAttempted && !phoneOk ? "phone-error" : undefined} data-testid="input-phone" />
          <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground"><Smartphone size={14} /> SMS verification isn't connected; this number remains unverified.</div>
          {basicsAttempted && !phoneOk && <p id="phone-error" role="alert" className="mt-1 text-xs text-destructive">Enter a valid 10-digit U.S. mobile number to continue.</p>}
          <p className="text-xs text-muted-foreground mt-5">See <Link href="/privacy" className="underline text-primary">Privacy</Link> and <Link href="/terms" className="underline text-primary">Terms</Link>.</p>
        </>}
        {step === 1 && <>
          <h2 className="font-display text-2xl font-extrabold">What are you hoping to find?</h2>
          <p className="text-muted-foreground mt-1">Choose any goals that fit. You can change them later.</p>
          <div className="mt-6">
            <ChoiceGroup title="Right now, I want to…" subtitle="Pick what would make this semester useful to you." choices={GOALS} value={goals} onToggle={(item) => toggle(goals, setGoals, item)} testId="goal" />
          </div>
          <div className="mt-7">
            <ChoiceGroup title="Which topics should we watch for?" subtitle="Specific subjects help narrow down the events and opportunities we surface." choices={TOPICS} value={interests} onToggle={(item) => toggle(interests, setInterests, item)} testId="topic" />
          </div>
          <label className="block mt-6 text-sm font-semibold" htmlFor="notes">What kind of opportunity would be a great fit?</label>
          <textarea id="notes" value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={1000} rows={3}
            placeholder="For example: beginner-friendly AI projects, paid summer internships, or events near my major."
            className="w-full rounded-xl bg-background border-2 border-input p-4 text-base mt-1.5 focus:outline-none focus:ring-2 focus:ring-primary/40" data-testid="input-goals-notes" />
        </>}
        {step === 2 && <>
          <h2 className="font-display text-2xl font-extrabold">Add your class schedule.</h2>
          <p className="text-muted-foreground mt-1">Upload an .ics, PDF, or image. It is read in your browser only, not uploaded or stored. Review every suggested block before saving.</p>
          <label className={`mt-5 flex min-h-16 items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-primary/50 bg-primary/5 px-4 py-4 text-center font-semibold cursor-pointer hover:bg-primary/10 ${importing ? "opacity-60 pointer-events-none" : ""}`}>
            <FileUp size={20} className="text-primary" />
            <span>{importing ? "Reading schedule…" : "Choose a schedule file"}</span>
            <input type="file" className="sr-only" accept=".ics,.pdf,image/png,image/jpeg,image/webp" onChange={handleFile} disabled={importing} data-testid="input-schedule-upload" />
          </label>
          <p className="mt-2 text-xs text-muted-foreground">Up to 12 MB and 12 PDF pages. Images and scanned PDFs are processed locally with English OCR; extracted blocks may need correction.</p>
          {importStatus && <p role="status" className="mt-3 rounded-xl bg-secondary px-4 py-3 text-sm" data-testid="text-schedule-import">{importStatus}</p>}
          <div className="mt-6">
            <p className="font-semibold">Review and edit your weekly classes</p>
            <p className="text-xs text-muted-foreground mt-1">You can also enter them manually.</p>
            <div className="mt-3"><ClassBlockEditor blocks={blocks} onChange={setBlocks} /></div>
          </div>
          <section className="mt-7 rounded-2xl border border-border bg-background p-4">
            <div className="flex items-center gap-2">
              <Mail size={18} className="text-primary" />
              <h3 className="font-display text-lg font-bold">Connect Gmail (optional)</h3>
            </div>
            <p className="text-sm text-muted-foreground mt-2">This could let ChatSC use message content to find relevant classes, clubs, events, and internships. It does not connect until Google OAuth is configured and you approve Google's permission screen.</p>
            <label className="flex items-start gap-3 mt-4 text-sm cursor-pointer">
              <input type="checkbox" checked={gmailConsent} onChange={(e) => setGmailConsent(e.target.checked)} className="mt-0.5 h-5 w-5 accent-[#990000] shrink-0" data-testid="checkbox-gmail-consent" />
              <span>I would like to connect Gmail and allow message-content access for personalized recommendations. I can skip this or change my choice later.</span>
            </label>
            <p className="flex items-center gap-2 mt-3 text-xs text-muted-foreground"><ShieldCheck size={14} /> Gmail isn't connected; ChatSC does not read or send email.</p>
          </section>
        </>}
        {step === 3 && <>
          <h2 className="font-display text-2xl font-extrabold">When should recommendations arrive?</h2>
          <p className="text-muted-foreground mt-1">Choose how often you would like to see personalized recommendations in ChatSC.</p>
          <fieldset className="mt-6">
            <legend className="sr-only">Recommendation frequency</legend>
            <div className="grid gap-3">
              {FREQ.map((f) => (
                <label key={f.v} className={`flex items-start gap-3 min-h-16 rounded-2xl border-2 p-4 cursor-pointer transition-colors focus-within:ring-2 focus-within:ring-accent ${freq === f.v ? "border-primary bg-primary/5" : "border-border hover:border-primary/40"}`}>
                  <input type="radio" name="freq" value={f.v} checked={freq === f.v} onChange={() => setFreq(f.v)} className="mt-1 h-5 w-5 accent-[#990000]" data-testid={`radio-freq-${f.v}`} />
                  <span><span className="font-semibold block">{f.label}</span><span className="text-sm text-muted-foreground">{f.sub}</span></span>
                </label>
              ))}
            </div>
          </fieldset>
          <div className="mt-6 rounded-2xl bg-accent/20 p-4 text-sm">
            <p className="font-semibold">Your setup so far</p>
            <p className="mt-1 text-muted-foreground">{goals.length} goals · {interests.length} topics · {blocks.length} class blocks · {gmailConsent ? "Gmail permission requested, not connected" : "Gmail skipped"}</p>
            <p className="mt-2 text-muted-foreground">Your email and phone remain unverified until code delivery is configured.</p>
          </div>
        </>}
        <div className="flex justify-between items-center mt-8">
          <button type="button" onClick={() => setStep((s) => Math.max(0, s - 1))} disabled={step === 0}
            className="inline-flex items-center gap-1 min-h-12 rounded-full px-4 py-2 font-semibold disabled:invisible hover:bg-secondary" data-testid="button-back"><ArrowLeft size={16} />Back</button>
          {step < 3
            ? <button type="button" onClick={goNext}
                disabled={importing}
                className="inline-flex items-center gap-2 min-h-12 rounded-full bg-primary text-primary-foreground px-6 py-2.5 font-semibold disabled:opacity-50" data-testid="button-next">Continue<ArrowRight size={16} /></button>
            : <button type="button" onClick={finish} disabled={save.isPending || !name.trim() || !emailOk || !phoneOk || !blocksOk}
                className="inline-flex items-center gap-2 min-h-12 rounded-full bg-primary text-primary-foreground px-6 py-2.5 font-semibold disabled:opacity-50" data-testid="button-finish">{save.isPending ? "Saving…" : "Save and finish"}<Check size={16} /></button>}
        </div>
        {save.isError && <p role="alert" className="mt-4 rounded-xl bg-destructive/10 p-3 text-sm text-destructive">We couldn't save your preferences. Check your information and try again.</p>}
      </div>
    </div>
  );
}
