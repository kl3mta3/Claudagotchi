import { useState, useEffect } from 'react';

/**
 * AuthScreen.jsx
 * First launch screen. Handles CLI install + claude login flow.
 * User never touches a terminal.
 */
export function AuthScreen({ onAuthenticated }) {
  const [step, setStep]       = useState('checking'); // checking|no-cli|install|login|done
  const [error, setError]     = useState(null);
  const [progress, setProgress] = useState('');

  // Run on mount
  useEffect(() => {
    checkEverything();
  }, []);

  async function checkEverything() {
    setStep('checking');
    setProgress('Checking for Claude CLI...');

    const hasCLI = await window.claudigotchi.checkCLI();
    if (!hasCLI) { setStep('no-cli'); return; }

    setProgress('Checking authentication...');
    const isAuthed = await window.claudigotchi.checkAuth();
    if (!isAuthed) { setStep('login'); return; }

    setStep('done');
    setTimeout(onAuthenticated, 800);
  }

  async function handleInstallCLI() {
    setStep('install');
    setProgress('Installing Claude CLI... (this may take a minute)');
    const result = await window.claudigotchi.installCLI();
    if (!result.ok) {
      setError(result.error);
      setStep('no-cli');
      return;
    }
    setStep('login');
  }

  async function handleLogin() {
    setProgress('Opening browser for sign in...');
    const authed = await window.claudigotchi.claudeLogin();
    if (authed) {
      setStep('done');
      setTimeout(onAuthenticated, 800);
    } else {
      setError('Sign in did not complete. Please try again.');
    }
  }

  return (
    <div style={styles.root}>
      <div style={styles.card}>
        {/* Logo — inline egg SVG (matches the splash window). */}
        <svg
          style={styles.logo}
          width="160"
          height="160"
          viewBox="0 0 100 100"
          xmlns="http://www.w3.org/2000/svg"
          aria-hidden="true"
        >
          <defs>
            <radialGradient id="authEggGrad" cx="40%" cy="35%">
              <stop offset="0%"  stopColor="#fff" stopOpacity="0.7" />
              <stop offset="100%" stopColor="#a855f7" />
            </radialGradient>
          </defs>
          <ellipse cx="50" cy="55" rx="32" ry="40" fill="url(#authEggGrad)" stroke="#3a1a55" strokeWidth="1.5" />
          <circle cx="38" cy="40" r="3.5" fill="#fff" opacity="0.5" />
          <circle cx="60" cy="48" r="2.5" fill="#fff" opacity="0.4" />
          <circle cx="44" cy="62" r="3"   fill="#fff" opacity="0.45" />
          <path d="M 24 50 L 32 46 L 36 52 L 44 47 L 50 53 L 58 48 L 64 53 L 72 49 L 76 54"
                fill="none" stroke="#3a1a55" strokeWidth="1.2" strokeLinecap="round" />
          <g fill="#ffd166">
            <circle cx="18" cy="22" r="1.8" />
            <circle cx="84" cy="30" r="1.4" />
            <circle cx="82" cy="78" r="1.6" />
            <circle cx="14" cy="74" r="1.2" />
          </g>
        </svg>
        <h1 style={styles.title}>Claudagotchi</h1>
        <p style={styles.subtitle}>Claude Code with a soul.</p>

        {step === 'checking' && (
          <div style={styles.status}>{progress}</div>
        )}

        {step === 'no-cli' && (
          <>
            <p style={styles.body}>
              Claudagotchi needs the Claude CLI to work.
              We'll install it automatically.
            </p>
            {error && <div style={styles.error}>{error}</div>}
            <button style={styles.btn} onClick={handleInstallCLI}>
              Install Claude CLI
            </button>
          </>
        )}

        {step === 'install' && (
          <div style={styles.status}>{progress}</div>
        )}

        {step === 'login' && (
          <>
            <p style={styles.body}>
              Sign in with your Anthropic account to get started.
              Your browser will open to complete sign in.
            </p>
            {error && <div style={styles.error}>{error}</div>}
            <button style={styles.btn} onClick={handleLogin}>
              Sign In with Anthropic
            </button>
            <p style={styles.fine}>
              Works with Free, Pro, Max, Teams, and Enterprise plans.
            </p>
          </>
        )}

        {step === 'done' && (
          <div style={styles.status}>✓ Signed in. Hatching your egg...</div>
        )}
      </div>
    </div>
  );
}

const styles = {
  root: {
    width: '100vw', height: '100vh',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    background: '#0a0a0f',
  },
  card: {
    display: 'flex', flexDirection: 'column', alignItems: 'center',
    gap: 16, padding: 48, maxWidth: 380, textAlign: 'center',
    background: '#111', borderRadius: 20, border: '1px solid #222',
  },
  logo:     { width: 120, height: 120, display: 'block' },
  title:    { fontSize: 28, fontWeight: 700, color: '#fff', margin: 0 },
  subtitle: { fontSize: 14, color: '#888', margin: 0 },
  body:     { fontSize: 14, color: '#bbb', lineHeight: 1.6, margin: 0 },
  status:   { fontSize: 13, color: '#888', fontStyle: 'italic' },
  error:    { fontSize: 12, color: '#e74c3c', background: '#1a0808', padding: '8px 14px', borderRadius: 8 },
  fine:     { fontSize: 11, color: '#555', margin: 0 },
  btn: {
    padding: '12px 32px', borderRadius: 12, fontSize: 15, fontWeight: 600,
    background: '#6c63ff', color: '#fff', border: 'none', cursor: 'pointer',
    width: '100%', transition: 'opacity 0.2s',
  },
};
