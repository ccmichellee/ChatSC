import { createContext, useContext, useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { Link } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowUp, Check, MessageCircle, Smartphone, X } from "lucide-react";
import { useCreateSignup, useSendChat, getGetProfileQueryKey } from "@workspace/api-client-react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";

type Msg = { id: number; role: "user" | "toji"; text: string; placeholder?: boolean; error?: boolean };
type Ctx = { openSignup: () => void; openChat: () => void };
const TojiCtx = createContext<Ctx>({ openSignup: () => {}, openChat: () => {} });
export const useToji = () => useContext(TojiCtx);

const CONSENT = "I agree to receive iMessage/text messages from Toji with recommendations about clubs, events, and opportunities. Reply STOP anytime to unsubscribe.";
const CHIPS = ["Clubs", "Hackathons", "Career events", "Free food", "Recruiting"];
const PROMPTS = ["Find clubs for me", "What's happening this week?", "Help me find an internship", "Where can I get free food today?"];

export function normalizeUsPhone(raw: string): string | null {
  if (!/^[0-9\s()+.\-]+$/.test(raw)) return null;
  let d = raw.replace(/\D/g, "");
  if (d.length === 11 && d.startsWith("1")) d = d.slice(1);
  if (d.length !== 10) return null;
  if (!/[2-9]/.test(d[0]) || !/[2-9]/.test(d[3])) return null;
  return `+1${d}`;
}

function TojiMark({ size = 40 }: { size?: number }) {
  return (
    <span aria-hidden style={{ width: size, height: size }} className="grid place-items-center rounded-2xl bg-primary text-primary-foreground font-display font-extrabold shrink-0" >
      <span style={{ fontSize: size * 0.48 }}>T</span>
    </span>
  );
}

export function TojiProvider({ children }: { children: ReactNode }) {
  const [signup, setSignup] = useState(false);
  const [chat, setChat] = useState(false);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  return (
    <TojiCtx.Provider value={{ openSignup: () => setSignup(true), openChat: () => setChat(true) }}>
      {children}
      <SignupDialog open={signup} onOpenChange={setSignup} />
      <ChatDialog open={chat} onOpenChange={setChat} msgs={msgs} setMsgs={setMsgs} />
      {!chat && (
        <button onClick={() => setChat(true)} data-testid="button-toji-launcher" aria-label="Chat with Toji"
          className="fixed z-40 bottom-4 right-4 md:bottom-6 md:right-6 inline-flex items-center gap-2 rounded-full bg-primary text-primary-foreground pl-3 pr-5 h-14 font-semibold shadow-[0_14px_30px_-12px_hsl(0_100%_25%/0.7)] hover:-translate-y-0.5 transition-transform rise">
          <span className="grid place-items-center w-9 h-9 rounded-full bg-accent text-accent-foreground"><MessageCircle size={18} /></span>
          <span>Chat with Toji</span>
        </button>
      )}
    </TojiCtx.Provider>
  );
}

export function TojiSection() {
  const { openSignup, openChat } = useToji();
  return (
    <section aria-labelledby="toji-heading" className="max-w-6xl mx-auto px-4 mt-14 rise" style={{ animationDelay: "200ms" }}>
      <div className="relative overflow-hidden rounded-[2rem] bg-foreground text-background p-6 md:p-10 grid md:grid-cols-[1.4fr_1fr] gap-8 items-center">
        <div aria-hidden className="absolute -right-16 -top-16 w-64 h-64 rounded-full bg-primary/60" />
        <div className="relative">
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-accent">Meet Toji</p>
          <h2 id="toji-heading" data-testid="text-toji-headline" className="font-display text-3xl md:text-5xl font-extrabold mt-2 leading-[1.05] text-balance">Talk to Toji, your AI campus assistant</h2>
          <p data-testid="text-toji-subtext" className="mt-4 text-lg text-background/80 max-w-xl">Toji texts USC students personalized clubs, events, and opportunities that fit your interests and class schedule, over iMessage.</p>
          <div className="mt-7 flex flex-col sm:flex-row gap-3">
            <button onClick={openSignup} data-testid="button-text-toji" className="inline-flex items-center justify-center gap-2 rounded-full bg-accent text-accent-foreground h-14 px-7 text-base font-bold hover:-translate-y-0.5 transition-transform">
              <Smartphone size={18} /> Text Toji
            </button>
            <button onClick={openChat} data-testid="button-chat-toji" className="inline-flex items-center justify-center gap-2 rounded-full border-2 border-background h-14 px-7 text-base font-bold hover:bg-background hover:text-foreground transition-colors">
              <MessageCircle size={18} /> Chat with Toji
            </button>
          </div>
        </div>
        <div className="relative hidden md:flex flex-col gap-2 text-sm" aria-hidden>
          <div className="self-end max-w-[80%] rounded-2xl rounded-br-md bg-primary text-primary-foreground px-4 py-2.5">Free between 1 and 3 on Tuesday. Anything good?</div>
          <div className="self-start max-w-[85%] rounded-2xl rounded-bl-md bg-background text-foreground px-4 py-2.5">A design club meetup near Leavey fits that gap. Want the details?</div>
          <p className="font-mono text-[10px] uppercase tracking-widest text-background/50 mt-1">Example conversation</p>
        </div>
      </div>
    </section>
  );
}

function SignupDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const qc = useQueryClient();
  const create = useCreateSignup({});
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [chips, setChips] = useState<string[]>([]);
  const [other, setOther] = useState("");
  const [classes, setClasses] = useState("");
  const [consent, setConsent] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [done, setDone] = useState(false);

  useEffect(() => { if (!open) { setDone(false); create.reset(); } }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (!name.trim()) errs.name = "Enter your first name.";
    const norm = normalizeUsPhone(phone);
    if (!norm) errs.phone = "Enter a valid US number, like (213) 555-0147.";
    if (!consent) errs.consent = "Please check the box to agree before signing up.";
    setErrors(errs);
    if (Object.keys(errs).length || !norm) return;
    const interests = [...chips, ...other.split(",").map((s) => s.trim()).filter(Boolean)].slice(0, 30).map((s) => s.slice(0, 100));
    create.mutate({ data: { first_name: name.trim().slice(0, 80), phone: norm, interests, classes: classes.trim().slice(0, 2000), consent: true } }, {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getGetProfileQueryKey() });
        setName(""); setPhone(""); setChips([]); setOther(""); setClasses(""); setConsent(false);
        setDone(true);
      },
    });
  };

  const field = "w-full h-12 rounded-xl border-2 border-input bg-card px-4 text-base focus:border-primary outline-none";
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[92dvh] overflow-y-auto rounded-3xl bg-background border-card-border p-6 md:p-8">
        {done ? (
          <div className="text-center py-6" role="status">
            <span className="mx-auto grid place-items-center w-16 h-16 rounded-full bg-accent text-accent-foreground"><Check size={30} /></span>
            <DialogTitle className="font-display text-3xl font-extrabold mt-5" data-testid="text-signup-success">You’re in! Toji will text you shortly.</DialogTitle>
            <DialogDescription className="mt-3 text-sm text-muted-foreground">Heads up: texts start once Toji's messaging bot is connected. Until then your signup is saved privately and nothing is sent.</DialogDescription>
            <button onClick={() => onOpenChange(false)} data-testid="button-signup-done" className="mt-6 rounded-full bg-primary text-primary-foreground h-12 px-8 font-semibold">Done</button>
          </div>
        ) : (
          <form onSubmit={submit} noValidate className="space-y-5">
            <div>
              <p className="font-mono text-xs uppercase tracking-[0.2em] text-primary">Text Toji</p>
              <DialogTitle className="font-display text-3xl font-extrabold mt-1">Get Toji in your texts</DialogTitle>
              <DialogDescription className="mt-2 text-sm text-muted-foreground">Text delivery isn't active yet. We'll save your signup now and Toji starts texting once the bot is connected.</DialogDescription>
            </div>
            <label className="block">
              <span className="text-sm font-semibold">First name</span>
              <input value={name} onChange={(e) => setName(e.target.value)} autoComplete="given-name" maxLength={80} aria-invalid={!!errors.name} className={`${field} mt-1.5`} data-testid="input-first-name" />
              {errors.name && <span className="text-sm text-destructive mt-1 block">{errors.name}</span>}
            </label>
            <label className="block">
              <span className="text-sm font-semibold">Phone number</span>
              <input value={phone} onChange={(e) => setPhone(e.target.value)} type="tel" inputMode="tel" autoComplete="tel" maxLength={30} placeholder="(213) 555-0147" aria-invalid={!!errors.phone} className={`${field} mt-1.5`} data-testid="input-phone" />
              {errors.phone && <span className="text-sm text-destructive mt-1 block">{errors.phone}</span>}
            </label>
            <fieldset>
              <legend className="text-sm font-semibold">Interests <span className="font-normal text-muted-foreground">(optional)</span></legend>
              <div className="flex flex-wrap gap-2 mt-2">
                {CHIPS.map((c) => {
                  const on = chips.includes(c);
                  return (
                    <button type="button" key={c} aria-pressed={on} onClick={() => setChips(on ? chips.filter((x) => x !== c) : [...chips, c])} data-testid={`chip-${c.toLowerCase().replace(/ /g, "-")}`}
                      className={`h-11 px-4 rounded-full border-2 text-sm font-semibold transition-colors ${on ? "bg-primary border-primary text-primary-foreground" : "border-input bg-card hover:border-primary"}`}>
                      {c}
                    </button>
                  );
                })}
              </div>
              <input value={other} onChange={(e) => setOther(e.target.value)} placeholder="Anything else? Separate with commas" aria-label="Other interests" className={`${field} mt-3`} data-testid="input-interests-other" />
            </fieldset>
            <label className="block">
              <span className="text-sm font-semibold">Current classes <span className="font-normal text-muted-foreground">(optional)</span></span>
              <textarea value={classes} onChange={(e) => setClasses(e.target.value)} maxLength={2000} rows={3} placeholder="e.g. WRIT 150 MW 10:00-11:50, CSCI 104 TTh 2:00" className="w-full rounded-xl border-2 border-input bg-card px-4 py-3 text-base focus:border-primary outline-none mt-1.5" data-testid="input-classes" />
            </label>
            <div>
              <label className="flex gap-3 items-start cursor-pointer">
                <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-1 w-6 h-6 accent-[hsl(0_100%_30%)] shrink-0" data-testid="checkbox-consent" />
                <span className="text-sm">{CONSENT}</span>
              </label>
              <p className="text-sm mt-2 ml-9 text-muted-foreground">
                See our <Link href="/privacy" onClick={() => onOpenChange(false)} className="underline text-primary font-semibold">Privacy Policy</Link> and <Link href="/terms" onClick={() => onOpenChange(false)} className="underline text-primary font-semibold">Terms</Link>.
              </p>
              {errors.consent && <span className="text-sm text-destructive mt-1 block ml-9">{errors.consent}</span>}
            </div>
            {create.isError && <p role="alert" className="text-sm text-destructive rounded-xl bg-destructive/10 px-4 py-3">We couldn't save your signup. Check your details and try again.</p>}
            <button type="submit" disabled={create.isPending} data-testid="button-submit-signup" className="w-full h-14 rounded-full bg-primary text-primary-foreground text-base font-bold disabled:opacity-60 hover:-translate-y-0.5 transition-transform">
              {create.isPending ? "Saving..." : "Sign me up"}
            </button>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

let msgId = 0;
function ChatDialog({ open, onOpenChange, msgs, setMsgs }: { open: boolean; onOpenChange: (o: boolean) => void; msgs: Msg[]; setMsgs: React.Dispatch<React.SetStateAction<Msg[]>> }) {
  const send = useSendChat();
  const [text, setText] = useState("");
  const [connected, setConnected] = useState<boolean | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" }); }, [msgs, send.isPending, open]);

  const go = (raw: string) => {
    const message = raw.trim().slice(0, 2000);
    if (!message || send.isPending) return;
    setMsgs((m) => [...m, { id: ++msgId, role: "user", text: message }]);
    setText("");
    send.mutate({ data: { message } }, {
      onSuccess: (r) => { setConnected(!r.placeholder); setMsgs((m) => [...m, { id: ++msgId, role: "toji", text: r.reply, placeholder: r.placeholder }]); },
      onError: () => setMsgs((m) => [...m, { id: ++msgId, role: "toji", text: "Toji couldn't reply just now. Try sending that again.", error: true }]),
    });
  };

  const retry = () => {
    const lastUser = [...msgs].reverse().find((m) => m.role === "user");
    if (!lastUser) return;
    setMsgs((m) => m.filter((x, i) => !(i === m.length - 1 && x.error)));
    const message = lastUser.text;
    send.mutate({ data: { message } }, {
      onSuccess: (r) => { setConnected(!r.placeholder); setMsgs((m) => [...m, { id: ++msgId, role: "toji", text: r.reply, placeholder: r.placeholder }]); },
      onError: () => setMsgs((m) => [...m, { id: ++msgId, role: "toji", text: "Still no reply. Please try again in a moment.", error: true }]),
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent onOpenAutoFocus={(e) => { e.preventDefault(); inputRef.current?.focus(); }}
        className="[&>button.absolute]:hidden p-0 gap-0 flex flex-col overflow-hidden bg-background border-card-border w-[100vw] max-w-none h-[100dvh] rounded-none sm:w-[420px] sm:max-w-[420px] sm:h-[min(640px,88dvh)] sm:rounded-3xl sm:left-auto sm:top-auto sm:right-6 sm:bottom-6 sm:translate-x-0 sm:translate-y-0">
        <header className="flex items-center gap-3 px-4 py-3 bg-primary text-primary-foreground">
          <TojiMark size={40} />
          <div className="min-w-0 flex-1">
            <DialogTitle className="font-display text-lg font-extrabold leading-tight">Chat with Toji</DialogTitle>
            <DialogDescription className="text-xs text-primary-foreground/80" data-testid="status-chat-connection">
              {connected ? "Connected to Toji" : "Preview mode: Toji's agent isn't connected yet"}
            </DialogDescription>
          </div>
          <button onClick={() => onOpenChange(false)} aria-label="Close chat" data-testid="button-close-chat" className="grid place-items-center w-11 h-11 rounded-full hover:bg-primary-foreground/15"><X size={20} /></button>
        </header>
        {!connected && <p className="px-4 py-2 text-xs bg-accent/40 text-accent-foreground">Replies here are placeholders, not real recommendations, until Toji is connected.</p>}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3" aria-live="polite">
          <div className="flex gap-2 items-end">
            <TojiMark size={28} />
            <div className="max-w-[85%] rounded-2xl rounded-bl-md bg-card border border-card-border px-4 py-2.5 text-sm">Hey, I'm Toji. Ask me about clubs, events, or opportunities around USC that fit your schedule.</div>
          </div>
          {msgs.length === 0 && (
            <div className="grid gap-2 pt-2">
              {PROMPTS.map((p, i) => (
                <button key={p} onClick={() => go(p)} data-testid={`button-prompt-${i}`} className="text-left min-h-12 rounded-2xl border-2 border-input bg-card px-4 py-2.5 text-sm font-semibold hover:border-primary transition-colors">{p}</button>
              ))}
            </div>
          )}
          {msgs.map((m) => m.role === "user" ? (
            <div key={m.id} className="flex justify-end"><div className="max-w-[85%] rounded-2xl rounded-br-md bg-primary text-primary-foreground px-4 py-2.5 text-sm whitespace-pre-wrap">{m.text}</div></div>
          ) : (
            <div key={m.id} className="flex gap-2 items-end">
              <TojiMark size={28} />
              <div className={`max-w-[85%] rounded-2xl rounded-bl-md px-4 py-2.5 text-sm whitespace-pre-wrap ${m.error ? "bg-destructive/10 text-destructive border border-destructive/30" : "bg-card border border-card-border"}`}>
                {m.placeholder && <span className="block font-mono text-[10px] uppercase tracking-widest text-muted-foreground mb-1">Placeholder reply</span>}
                {m.text}
                {m.error && <button onClick={retry} disabled={send.isPending} className="block mt-2 underline font-semibold" data-testid="button-chat-retry">Retry</button>}
              </div>
            </div>
          ))}
          {send.isPending && (
            <div className="flex gap-2 items-end" role="status" aria-label="Toji is typing">
              <TojiMark size={28} />
              <div className="rounded-2xl rounded-bl-md bg-card border border-card-border px-4 py-3 flex gap-1">
                {[0, 1, 2].map((i) => <span key={i} className="w-2 h-2 rounded-full bg-muted-foreground animate-bounce" style={{ animationDelay: `${i * 120}ms` }} />)}
              </div>
            </div>
          )}
          <div ref={endRef} />
        </div>
        <form onSubmit={(e) => { e.preventDefault(); go(text); }} className="flex items-end gap-2 p-3 border-t border-border bg-card">
          <textarea ref={inputRef} value={text} onChange={(e) => setText(e.target.value)} rows={1} maxLength={2000} aria-label="Message Toji" placeholder="Message Toji"
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); go(text); } }}
            className="flex-1 resize-none max-h-32 min-h-12 rounded-2xl border-2 border-input bg-background px-4 py-3 text-base outline-none focus:border-primary" data-testid="input-chat" />
          <button type="submit" disabled={!text.trim() || send.isPending} aria-label="Send message" data-testid="button-send-chat" className="grid place-items-center w-12 h-12 rounded-full bg-primary text-primary-foreground disabled:opacity-50 shrink-0"><ArrowUp size={20} /></button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
