import { useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, ArrowRight, Check } from "lucide-react";
import { useGetProfile, useGetSummary, useSaveOnboarding, getGetProfileQueryKey, type ClassBlock, type StudentInputFrequency } from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";
import { ClassBlockEditor } from "@/components/class-blocks";
import { blockOverlaps } from "@/lib/campus";

const FALLBACK = ["Tech", "Arts", "Career", "Sports", "Music", "Social", "Volunteering", "Research", "Wellness", "Culture"];
const FREQ: { v: StudentInputFrequency; label: string; sub: string }[] = [
  { v: "daily", label: "Daily", sub: "A short morning digest" },
  { v: "twice-weekly", label: "Twice a week", sub: "Monday and Thursday" },
  { v: "weekly", label: "Weekly", sub: "One Sunday roundup" },
];
const inp = "h-11 w-full rounded-full bg-background border border-input px-4 focus:outline-none focus:ring-2 focus:ring-primary/40";

export default function Onboarding() {
  const [, nav] = useLocation();
  const qc = useQueryClient();
  const { toast } = useToast();
  const profile = useGetProfile();
  const { data: summary } = useGetSummary();
  const save = useSaveOnboarding();
  const [step, setStep] = useState(0);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [consent, setConsent] = useState(false);
  const [interests, setInterests] = useState<string[]>([]);
  const [blocks, setBlocks] = useState<ClassBlock[]>([]);
  const [freq, setFreq] = useState<StudentInputFrequency>("weekly");
  const inited = useRef(false);
  useEffect(() => {
    const p = profile.data;
    if (p && !inited.current) {
      inited.current = true;
      setName(p.name ?? ""); setConsent(p.consent); setInterests(p.interests ?? []); setBlocks(p.availability ?? []);
      if (p.frequency === "daily" || p.frequency === "weekly" || p.frequency === "twice-weekly") setFreq(p.frequency);
    }
  }, [profile.data]);

  const digits = phone.replace(/\D/g, "");
  const phoneOk = (profile.data?.onboarded && digits.length === 0) || digits.length === 10 || (digits.length === 11 && digits.startsWith("1"));
  const tags = summary?.tags.length ? summary.tags : FALLBACK;
  const blocksOk = blockOverlaps(blocks).size === 0 && !blocks.some((b) => b.end <= b.start);
  const toggle = (t: string) => setInterests((x) => (x.includes(t) ? x.filter((y) => y !== t) : [...x, t]));

  const finish = () => save.mutate({ data: { phone, consent, interests, availability: blocks, frequency: freq, name: name.trim() || undefined } }, {
    onSuccess: (p) => {
      qc.setQueryData(getGetProfileQueryKey(), p);
      qc.invalidateQueries({ queryKey: getGetProfileQueryKey() });
      qc.invalidateQueries({ queryKey: ["/api/recommendations"] });
      qc.invalidateQueries({ queryKey: ["/api/events"] });
      toast({ title: "You're all set", description: "Your recommendations are ready on the home page." });
      nav("/");
    },
    onError: () => toast({ title: "Couldn't save your profile", description: "Please try again.", variant: "destructive" }),
  });

  const steps = ["About you", "Interests", "Your week"];
  return (
    <div className="max-w-2xl mx-auto px-4 py-10">
      <ol className="flex gap-2 mb-8" aria-label="Progress">
        {steps.map((s, i) => (
          <li key={s} className="flex-1" aria-current={i === step ? "step" : undefined}>
            <div className={`h-1.5 rounded-full transition-colors ${i <= step ? "bg-primary" : "bg-border"}`} />
            <p className={`mt-2 font-mono text-[11px] uppercase tracking-wider ${i === step ? "text-primary" : "text-muted-foreground"}`}>{i + 1}. {s}</p>
          </li>
        ))}
      </ol>
      <div key={step} className="rise rounded-[2rem] bg-card border border-card-border p-6 md:p-8">
        {step === 0 && <>
          <h1 className="font-display text-3xl font-extrabold">Let's make this yours.</h1>
          <p className="text-muted-foreground mt-1">Optional, but it helps us greet you properly.</p>
          <label className="block mt-6 text-sm font-semibold" htmlFor="name">First name</label>
          <input id="name" value={name} onChange={(e) => setName(e.target.value)} className={`${inp} mt-1`} placeholder="Tommy" data-testid="input-name" />
          <label className="block mt-4 text-sm font-semibold" htmlFor="phone">Mobile number</label>
          <div className="flex gap-2 mt-1">
            <input id="phone" type="tel" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} className={inp} placeholder="(213) 555-0147" aria-invalid={!phoneOk} data-testid="input-phone" />
            <button type="button" disabled={digits.length < 10} data-testid="button-verify"
              onClick={() => toast({ title: "Verification is a placeholder", description: "No SMS was sent. Phone verification isn't active in this demo." })}
              className="rounded-full border-2 border-foreground px-5 font-semibold disabled:opacity-40">Verify</button>
          </div>
          {!phoneOk && <p className="text-xs text-destructive mt-1">Enter a valid 10-digit US number.</p>}
          <p className="text-xs text-muted-foreground mt-1">Verify is a placeholder. No SMS will be sent.</p>
          <label className="mt-5 flex items-start gap-3 rounded-2xl bg-secondary/60 p-4 cursor-pointer">
            <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-0.5 w-4 h-4 accent-[#990000]" data-testid="checkbox-consent" />
            <span className="text-sm">I agree to receive texts. Reply STOP anytime to unsubscribe.</span>
          </label>
        </>}
        {step === 1 && <>
          <h1 className="font-display text-3xl font-extrabold">What pulls you in?</h1>
          <p className="text-muted-foreground mt-1">Pick as many as you like. We'll use them to sort your recommendations.</p>
          <div className="flex flex-wrap gap-2 mt-6" role="group" aria-label="Interests">
            {tags.map((t) => {
              const on = interests.includes(t);
              return <button key={t} type="button" aria-pressed={on} onClick={() => toggle(t)} data-testid={`chip-interest-${t}`}
                className={`inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-semibold border-2 transition-all hover:-translate-y-0.5 ${on ? "bg-primary border-primary text-primary-foreground" : "border-border bg-background"}`}>{on && <Check size={14} />}{t}</button>;
            })}
          </div>
          <p className="mt-4 font-mono text-xs text-muted-foreground">{interests.length} selected</p>
        </>}
        {step === 2 && <>
          <h1 className="font-display text-3xl font-extrabold">When are you in class?</h1>
          <p className="text-muted-foreground mt-1">We'll flag events that clash. Monday through Sunday, Los Angeles time.</p>
          <div className="mt-6"><ClassBlockEditor blocks={blocks} onChange={setBlocks} /></div>
          <fieldset className="mt-8">
            <legend className="font-semibold">How often should we check in?</legend>
            <div className="grid sm:grid-cols-3 gap-2 mt-2">
              {FREQ.map((f) => (
                <label key={f.v} className={`rounded-2xl border-2 p-3 cursor-pointer transition-colors focus-within:ring-2 focus-within:ring-accent ${freq === f.v ? "border-primary bg-primary/5" : "border-border"}`}>
                  <input type="radio" name="freq" value={f.v} checked={freq === f.v} onChange={() => setFreq(f.v)} className="sr-only" data-testid={`radio-freq-${f.v}`} />
                  <span className="font-semibold block">{f.label}</span><span className="text-xs text-muted-foreground">{f.sub}</span>
                </label>
              ))}
            </div>
          </fieldset>
        </>}
        <div className="flex justify-between mt-8">
          <button type="button" onClick={() => setStep((s) => s - 1)} disabled={step === 0} className="inline-flex items-center gap-1 rounded-full px-4 py-2 font-semibold disabled:invisible hover:bg-secondary" data-testid="button-back"><ArrowLeft size={16} />Back</button>
          {step < 2
            ? <button type="button" onClick={() => setStep((s) => s + 1)} disabled={!phoneOk || !consent || (step === 1 && interests.length === 0)} className="inline-flex items-center gap-1 rounded-full bg-primary text-primary-foreground px-6 py-2.5 font-semibold disabled:opacity-50" data-testid="button-next">Next<ArrowRight size={16} /></button>
            : <button type="button" onClick={finish} disabled={save.isPending || !blocksOk || !phoneOk || !consent || interests.length === 0} className="inline-flex items-center gap-1 rounded-full bg-primary text-primary-foreground px-6 py-2.5 font-semibold disabled:opacity-50" data-testid="button-finish">{save.isPending ? "Saving" : "Finish"}<Check size={16} /></button>}
        </div>
      </div>
    </div>
  );
}
