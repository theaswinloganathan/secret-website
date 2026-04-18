import { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { fetchAPI } from '../api';
import Particles from '../components/Particles';

const LoginPage = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [shake, setShake] = useState(false);
  const navigate = useNavigate();
  const cardRef = useRef(null);

  // Redirect if already logged in
  useEffect(() => {
    if (localStorage.getItem('token') && localStorage.getItem('user')) {
      navigate('/search');
    }
  }, [navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const data = await fetchAPI('/login', {
        method: 'POST',
        body: JSON.stringify({ username, loginPassword: password }),
      });

      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));
      navigate('/search');
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
      <div
        ref={cardRef}
        className={`glass-card ${shake ? 'shake' : ''}`}
      >
        <div className="branding">
          <h1>Private Chat</h1>
          <p>Private chat. Your rules.</p>
        </div>

        {error && <div className="error-message visible">{error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="input-group">
            <input
              type="text"
              id="username"
              placeholder=" "
              required
              autoComplete="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
            />
            <label htmlFor="username">Username</label>
            <div className="input-focus-glow" />
          </div>

          <div className="input-group">
            <input
              type={showPass ? 'text' : 'password'}
              id="loginPassword"
              placeholder=" "
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <label htmlFor="loginPassword">Password</label>
            <button
              type="button"
              className="password-toggle"
              onClick={() => setShowPass(!showPass)}
            >
              {showPass ? '🙈' : '👁️'}
            </button>
            <div className="input-focus-glow" />
          </div>

          <button
            type="submit"
            className="btn-primary"
            disabled={loading}
            onClick={addRipple}
          >
            <span>{loading ? 'Authenticating...' : 'Log In'}</span>
          </button>
        </form>

        <div className="form-footer">
          <p>
            Don&apos;t have an account?{' '}
            <Link to="/signup">Create Access</Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
