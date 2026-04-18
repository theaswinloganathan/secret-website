import { useState, useCallback, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { fetchAPI } from '../api';
import Particles from '../components/Particles';

const SignupPage = () => {
  const [step, setStep] = useState(1);
  const [username, setUsername] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [chatPassword, setChatPassword] = useState('');
  const [showLoginPass, setShowLoginPass] = useState(false);
  const [showChatPass, setShowChatPass] = useState(false);
  const [strength, setStrength] = useState(0);
  const [strengthColor, setStrengthColor] = useState('#ff3366');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [shake, setShake] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    if (localStorage.getItem('token') && localStorage.getItem('user')) {
      navigate('/search');
    }
  }, [navigate]);

  const calcStrength = (val) => {
    let s = 0;
    if (val.length > 5) s += 33;
    if (/[A-Z]/.test(val)) s += 33;
    if (/[0-9]/.test(val)) s += 34;
    setStrength(s);
    if (s < 40) setStrengthColor('#ff3366');
    else if (s < 80) setStrengthColor('#ffcc00');
    else setStrengthColor('#00ff88');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await fetchAPI('/register', {
        method: 'POST',
        body: JSON.stringify({ username, loginPassword, chatPassword }),
      });
      alert('Access Generated Successfully. Redirecting to Terminal...');
      navigate('/');
    } catch (err) {
      setError(err.message);
      setShake(true);
      setTimeout(() => setShake(false), 400);
    } finally {
      setLoading(false);
    }
  };

  const addRipple = useCallback((e) => {
    const btn = e.currentTarget;
    const ripple = document.createElement('span');
    ripple.className = 'ripple';
    const rect = btn.getBoundingClientRect();
    ripple.style.left = (e.clientX - rect.left) + 'px';
    ripple.style.top = (e.clientY - rect.top) + 'px';
    btn.appendChild(ripple);
    setTimeout(() => ripple.remove(), 600);
  }, []);

  return (
    <div className="auth-page">
      <Particles />
      <div className={`glass-card ${shake ? 'shake' : ''}`}>
        <div className="branding">
          <h1>Initialize Access</h1>
          <p>Private chat. Your rules.</p>
        </div>

        {/* Step Indicator */}
        <div className="step-indicator">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className={`step-dot ${i <= step ? 'active' : ''}`}
            />
          ))}
        </div>

        {error && <div className="error-message visible">{error}</div>}

        <form onSubmit={handleSubmit}>
          {/* Step 1 */}
          <div className={`signup-step ${step === 1 ? 'active' : ''}`}>
            <div className="input-group">
              <input
                type="text"
                placeholder=" "
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && setStep(2)}
              />
              <label>Unique Username</label>
              <div className="input-focus-glow" />
            </div>
            <button
              type="button"
              className="btn-primary"
              onClick={(e) => { addRipple(e); setStep(2); }}
            >
              Next Phase
            </button>
          </div>

          {/* Step 2 */}
          <div className={`signup-step ${step === 2 ? 'active' : ''}`}>
            <div className="input-group">
              <input
                type={showLoginPass ? 'text' : 'password'}
                placeholder=" "
                required
                value={loginPassword}
                onChange={(e) => { setLoginPassword(e.target.value); calcStrength(e.target.value); }}
                onKeyDown={(e) => e.key === 'Enter' && setStep(3)}
              />
              <label>Master Password</label>
              <button
                type="button"
                className="password-toggle"
                onClick={() => setShowLoginPass(!showLoginPass)}
              >
                {showLoginPass ? '🙈' : '👁️'}
              </button>
              <div className="input-focus-glow" />
            </div>
            <div className="strength-meter">
              <div
                className="strength-bar"
                style={{ width: strength + '%', background: strengthColor }}
              />
            </div>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                type="button"
                className="btn-primary"
                style={{ background: 'rgba(255,255,255,0.05)' }}
                onClick={(e) => { addRipple(e); setStep(1); }}
              >
                Back
              </button>
              <button
                type="button"
                className="btn-primary"
                onClick={(e) => { addRipple(e); setStep(3); }}
              >
                Secure Password
              </button>
            </div>
          </div>

          {/* Step 3 */}
          <div className={`signup-step ${step === 3 ? 'active' : ''}`}>
            <div className="input-group">
              <input
                type={showChatPass ? 'text' : 'password'}
                placeholder=" "
                required
                value={chatPassword}
                onChange={(e) => setChatPassword(e.target.value)}
              />
              <label>Secret Chat Key 🔐</label>
              <button
                type="button"
                className="password-toggle"
                onClick={() => setShowChatPass(!showChatPass)}
              >
                {showChatPass ? '🙈' : '👁️'}
              </button>
              <div className="input-focus-glow" />
            </div>
            <span className="helper-text">
              Only users with this key can chat with you. Keep it safe.
            </span>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                type="button"
                className="btn-primary"
                style={{ background: 'rgba(255,255,255,0.05)' }}
                onClick={(e) => { addRipple(e); setStep(2); }}
              >
                Back
              </button>
              <button
                type="submit"
                className="btn-primary"
                disabled={loading}
                onClick={addRipple}
              >
                <span>{loading ? 'Generating Access...' : 'Activate Access'}</span>
              </button>
            </div>
          </div>
        </form>

        <div className="form-footer">
          <p>
            Already authorized? <Link to="/">Log In</Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default SignupPage;
