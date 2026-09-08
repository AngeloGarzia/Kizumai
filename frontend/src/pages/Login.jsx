import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import AuthLayout from '../components/AuthLayout.jsx';
import Button from '../components/Button.jsx';
import Input from '../components/Input.jsx';

import { getProjectDraft } from '../services/projectService.js';

const REMEMBER_EMAIL_KEY = 'kizumai_remember_email';

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(true);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(REMEMBER_EMAIL_KEY);
      if (saved) {
        setEmail(saved);
        setRememberMe(true);
      }
    } catch {
      // ignore
    }
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);

    try {
      const loggedUser = await login(email, password, { rememberMe });
      try {
        if (rememberMe) localStorage.setItem(REMEMBER_EMAIL_KEY, email.trim());
        else localStorage.removeItem(REMEMBER_EMAIL_KEY);
      } catch {
        // ignore
      }

      const draft = getProjectDraft();
      const from = location.state?.from?.pathname;
      const safeFrom =
        typeof from === 'string' && /^\/(?!\/)/.test(from) && !from.includes('\\')
          ? from
          : null;
      const isAdmin = loggedUser.role === 'admin';
      const isPaid = loggedUser.plan === 'paid' || isAdmin;

      if (draft) {
        navigate('/projet/apercu');
      } else if (safeFrom && isPaid) {
        navigate(safeFrom, { replace: true });
      } else if (isAdmin) {
        navigate('/admin');
      } else if (isPaid) {
        navigate('/');
      } else {
        navigate('/');
      }
    } catch (err) {
      setError(err.message || 'Échec de la connexion');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthLayout title="Connexion" subtitle="Accédez à votre espace">
      <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-5">
        <Input
          id="email"
          label="Email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          autoComplete="email"
        />

        <Input
          id="password"
          label="Mot de passe"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          autoComplete="current-password"
        />

        <label className="flex items-center gap-2.5 text-sm text-prune-700 cursor-pointer select-none">
          <input
            id="rememberMe"
            type="checkbox"
            checked={rememberMe}
            onChange={(e) => setRememberMe(e.target.checked)}
            className="h-4 w-4 rounded border-prune-300 text-wasabi-600 focus:ring-wasabi-400"
          />
          Se souvenir de moi
        </label>

        {error && <p className="alert-error">{error}</p>}

        <Button type="submit" disabled={submitting}>
          {submitting ? 'Connexion...' : 'Se connecter'}
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-prune-600">
        Pas de compte ?{' '}
        <Link to="/register" className="link-accent">
          S&apos;inscrire
        </Link>
      </p>
    </AuthLayout>
  );
}
