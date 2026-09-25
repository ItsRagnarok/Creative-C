"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const redirectTo = params.get("redirectTo") || "/dashboard";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resetSent, setResetSent] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) {
      setError("Email sau parolă incorecte.");
      return;
    }
    router.push(redirectTo);
    router.refresh();
  }

  async function handleForgotPassword() {
    if (!email) {
      setError("Scrie-ți emailul mai întâi, ca să-ți putem trimite link-ul de resetare.");
      return;
    }
    setError(null);
    const supabase = createClient();
    await supabase.auth.resetPasswordForEmail(email);
    setResetSent(true);
  }

  return (
    <div className="auth-wrap">
      <div className="auth-side">
        <div style={{ position: "relative" }}>
          <div className="brand" style={{ padding: "0 0 40px" }}>
            <div className="brand-mark" style={{ width: 44, height: 44, fontSize: 18 }}>CC</div>
            <div>
              <div className="brand-name" style={{ fontSize: 19 }}>Creative C</div>
              <div className="brand-sub">CRM intern</div>
            </div>
          </div>
          <h1 style={{ fontSize: 32, maxWidth: 460 }}>Clienți, proiecte și echipă, într-un singur loc.</h1>
          <p style={{ maxWidth: 420, marginTop: 10 }}>
            Pipeline de vânzări, contracte, facturare, proiecte video și canalele editorilor — un
            singur sistem, cu acces controlat pe roluri.
          </p>

          <div className="security-list">
            <div className="item"><span className="ic">🔒</span> Criptare TLS în tranzit, sesiune păstrată în cookie securizat.</div>
            <div className="item"><span className="ic">🧭</span> Acces pe roluri — fiecare cont vede exact ce are voie.</div>
            <div className="item"><span className="ic">🛡️</span> Reguli de acces aplicate direct la nivel de bază de date (RLS).</div>
            <div className="item"><span className="ic">🔑</span> Autentificare în doi factori — în lucru, urmează într-o iterație viitoare.</div>
          </div>
        </div>
      </div>

      <div className="auth-form-wrap">
        <div className="auth-card">
          <h2 style={{ fontSize: 20 }}>Autentificare</h2>
          <p style={{ marginBottom: 22 }}>Introdu datele contului tău Creative C.</p>

          <form onSubmit={handleSubmit}>
            <div className="field">
              <label htmlFor="email">Email de lucru</label>
              <input
                id="email"
                type="email"
                required
                placeholder="alex@creativec.ro"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
              />
            </div>
            <div className="field">
              <label htmlFor="password">Parolă</label>
              <input
                id="password"
                type="password"
                required
                placeholder="••••••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
              />
            </div>

            {error && <div className="field-error">{error}</div>}
            {resetSent && (
              <div className="field-error" style={{ color: "var(--accent-2)" }}>
                Dacă adresa există în platformă, ai primit un email cu link de resetare.
              </div>
            )}

            <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 18, marginTop: -4 }}>
              <button type="button" onClick={handleForgotPassword} style={{ background: "none", border: "none", fontSize: 12.5, color: "var(--accent-2)", cursor: "pointer" }}>
                Ai uitat parola?
              </button>
            </div>

            <button type="submit" className="btn primary" style={{ width: "100%", justifyContent: "center" }} disabled={loading}>
              {loading ? "Se verifică…" : "Autentificare"}
            </button>
          </form>

          <div className="empty-note" style={{ marginTop: 22, textAlign: "left" }}>
            <b style={{ color: "var(--text-muted)" }}>Ești client?</b> Portalul de client separat vine
            într-o iterație următoare — pentru acum, acest ecran e doar pentru echipă.
          </div>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}
