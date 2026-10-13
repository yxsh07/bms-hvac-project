import type { FormEvent } from 'react';
import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import './login.css';

const demoUsers = [
  { email: 'admin@bms.local', password: 'admin123', role: 'Administrator' },
  { email: 'engineer@bms.local', password: 'eng123', role: 'HVAC Engineer' },
  { email: 'manager@bms.local', password: 'mgr123', role: 'Facility Manager' },
  { email: 'operator@bms.local', password: 'op123', role: 'Operator' },
  { email: 'executive@bms.local', password: 'exec123', role: 'Executive' },
];

export function Login() {
  const { login, isLoading } = useAuth();
  const [email, setEmail] = useState('engineer@bms.local');
  const [password, setPassword] = useState('eng123');
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    setError('');
    void login({ email, password }).catch((reason) => setError(reason instanceof Error ? reason.message : 'Sign in failed'));
  };

  return (
    <div className="login-layout">
      <aside className="login-story">
        <div className="login-brand"><span className="login-mark"><i /><i /><i /></span><span>BMS<b>Twin</b><small>OPERATIONS CONSOLE</small></span></div>
        <div className="login-story-body"><span className="login-eyebrow">FACILITY INTELLIGENCE / 01</span><h1>See the whole<br />system.</h1><p>One place to understand the building, trace plant performance, and respond with confidence.</p><div className="login-art" aria-hidden="true"><div className="login-art-floor">LEVEL 05 <span>COMFORT ZONES</span></div><div className="login-art-floor">LEVEL 03 <span>AIR HANDLING</span></div><div className="login-art-floor">LEVEL 01 <span>PUBLIC SPACES</span></div><div className="login-art-floor">PLANT <span>CHILLED WATER</span></div></div></div>
        <div className="login-story-foot"><span className="login-live-dot" /> SIMSITE PROTOTYPE <span>DESIGNED FOR OPERATORS</span></div>
      </aside>
      <main className="login-form-side"><div className="login-form-wrap"><div className="login-mobile-brand">BMSTwin <span>Operations console</span></div><span className="login-eyebrow">SECURE WORKSPACE</span><h2>Welcome back</h2><p className="login-form-intro">Sign in to open the site overview.</p>
        {error && <p className="login-error" role="alert">{error}</p>}
        <form onSubmit={handleSubmit} className="login-form"><label htmlFor="email">Email address</label><input id="email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} required autoComplete="email" disabled={isLoading} /><label htmlFor="password">Password</label><div className="login-password"><input id="password" type={showPassword ? 'text' : 'password'} value={password} onChange={(event) => setPassword(event.target.value)} required autoComplete="current-password" disabled={isLoading} /><button type="button" onClick={() => setShowPassword(!showPassword)} aria-label={showPassword ? 'Hide password' : 'Show password'}>{showPassword ? 'Hide' : 'Show'}</button></div><button className="login-submit" type="submit" disabled={isLoading}>{isLoading ? 'Signing in…' : 'Sign in'} <span aria-hidden="true">→</span></button></form>
        <div className="login-demo"><div><span className="login-eyebrow">DEMO ACCESS</span><p>Choose a role to fill the form.</p></div><div className="login-demo-list">{demoUsers.map((user) => <button key={user.email} type="button" onClick={() => { setEmail(user.email); setPassword(user.password); }} disabled={isLoading}><span>{user.role}</span><small>{user.email}</small></button>)}</div></div>
      </div><p className="login-footer">BMS digital twin · Prototype environment</p></main>
    </div>
  );
}
