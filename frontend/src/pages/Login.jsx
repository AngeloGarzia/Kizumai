import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import AuthLayout from '../components/AuthLayout.jsx';
import Button from '../components/Button.jsx';
import Input from '../components/Input.jsx';

import { getProjectDraft } from '../services/projectService.js';

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);

    try {
      const loggedUser = await login(email, password);
      const draft = getProjectDraft();

      if (draft) {
        navigate('/projet/apercu');
      } else if (loggedUser.plan === 'paid' || loggedUser.role === 'admin') {
        navigate('/dashboard');
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
