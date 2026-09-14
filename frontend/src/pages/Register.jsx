import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import AuthLayout from '../components/AuthLayout.jsx';
import Button from '../components/Button.jsx';
import Input from '../components/Input.jsx';
import { authService } from '../services/authService.js';

export default function Register() {
  const { register } = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [pendingEmail, setPendingEmail] = useState('');
  const [resendMessage, setResendMessage] = useState('');
  const [resending, setResending] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setResendMessage('');
    setSubmitting(true);

    try {
      const result = await register(name, email, password);
      if (result?.pendingVerification) {
        setPendingEmail(result.email || email.trim().toLowerCase());
        return;
      }
    } catch (err) {
      setError(err.message || "Échec de l'inscription");
    } finally {
      setSubmitting(false);
    }
  };

  const handleResend = async () => {
    if (!pendingEmail) return;
    setResending(true);
    setError('');
    setResendMessage('');
    try {
      const result = await authService.resendConfirmation(pendingEmail);
      setResendMessage(result.message || 'Email renvoyé si le compte est en attente.');
    } catch (err) {
      setError(err.message || "Impossible de renvoyer l'email");
    } finally {
      setResending(false);
    }
  };

  if (pendingEmail) {
    return (
      <AuthLayout
        title="Vérifiez votre email"
        subtitle="Un dernier clic pour activer votre compte"
      >
        <div className="space-y-4">
          <p className="text-sm text-prune-700">
            Nous avons envoyé un lien de confirmation à{' '}
            <strong className="text-prune-900">{pendingEmail}</strong>. Ouvrez cet email et
            cliquez sur « Confirmer mon email » pour activer votre compte. Sans cette étape,
            la connexion reste bloquée.
          </p>
          <p className="text-sm text-prune-600">
            Pensez à vérifier vos indésirables. Le lien expire sous 48 heures.
          </p>

          {error && <p className="alert-error">{error}</p>}
          {resendMessage && <p className="text-sm text-wasabi-700">{resendMessage}</p>}

          <Button type="button" onClick={handleResend} disabled={resending}>
            {resending ? 'Envoi…' : 'Renvoyer l’email de confirmation'}
          </Button>

          <p className="text-center text-sm text-prune-600">
            Déjà confirmé ?{' '}
            <Link to="/login" className="link-accent">
              Se connecter
            </Link>
          </p>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout title="Inscription" subtitle="Créez votre compte Kizumai">
      <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-5">
        <Input
          id="name"
          label="Nom"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          autoComplete="name"
        />

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
          minLength={10}
          required
          autoComplete="new-password"
          hint="Au moins 10 caractères, une lettre et un chiffre"
        />

        {error && <p className="alert-error">{error}</p>}

        <Button type="submit" disabled={submitting}>
          {submitting ? 'Inscription...' : "S'inscrire"}
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-prune-600">
        Déjà un compte ?{' '}
        <Link to="/login" className="link-accent">
          Se connecter
        </Link>
      </p>
    </AuthLayout>
  );
}
