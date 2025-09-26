import React, { useEffect, useRef, useState } from 'react';
import axios from 'axios';
import OtpModal from './OtpModal';
import { useTranslation } from 'react-i18next';
import '../Styles/GoogleSignIn.css';

export default function GoogleSignIn({ onSuccess }) {
  const { t, i18n } = useTranslation();
  const btnRef = useRef(null);
  const [idToken, setIdToken] = useState(null);
  const [email, setEmail] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [status, setStatus] = useState('init'); // init | ready | missingId | scriptError

  useEffect(() => {
    const clientId = window.GOOGLE_CLIENT_ID || process.env.REACT_APP_GOOGLE_CLIENT_ID;
    if (!clientId) { setStatus('missingId'); return; }

    function init() {
      try {
        window.google.accounts.id.initialize({
          client_id: clientId,
          callback: handleCredentialResponse,
          ux_mode: 'popup',
          auto_select: false,
          itp_support: true,
          context: 'signin'
        });
        if (btnRef.current) {
          window.google.accounts.id.renderButton(btnRef.current, {
            type: 'standard',
            theme: 'outline',
            size: 'large',
            text: 'signin_with',
            logo_alignment: 'left'
          });
          btnRef.current.setAttribute('aria-label', t('google.signIn'));
          btnRef.current.setAttribute('title', t('google.signIn'));
        }
        setStatus('ready');
      } catch (e) {
        console.error(e);
        setStatus('scriptError');
      }
    }

    if (!window.google?.accounts?.id) {
      const s = document.createElement('script');
      s.src = 'https://accounts.google.com/gsi/client';
      s.async = true; s.defer = true;
      s.onload = init;
      s.onerror = () => setStatus('scriptError');
      document.body.appendChild(s);
    } else {
      init();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [i18n.language]);

  async function handleCredentialResponse(response) {
    try {
      const id_token = response.credential;
      setIdToken(id_token);
      const { data } = await axios.post(
        '/api/auth/google/start',
        { id_token, lang: i18n.language },
        { withCredentials: true }
      );
      if (data.ok) {
        setEmail(data.email);
        setShowModal(true);
      } else {
        alert(data.error || t('google.errors.start'));
      }
    } catch (e) {
      console.error(e);
      alert(t('google.errors.startGeneric'));
    }
  }

  async function verify(code) {
    try {
      const { data } = await axios.post(
        '/api/auth/google/verify',
        { id_token: idToken, code, lang: i18n.language },
        { withCredentials: true }
      );
      if (data.ok) {
        setShowModal(false);
        if (onSuccess) onSuccess(data.user);
        else window.location.reload();
      } else {
        alert(data.error || t('google.errors.invalidCode'));
      }
    } catch (e) {
      const msg = e?.response?.data?.error || t('google.errors.verifyGeneric');
      console.error(e);
      alert(msg);
    }
  }

  return (
    <>
      <div ref={btnRef} aria-label={t('google.signIn')} title={t('google.signIn')} />
      {status === 'missingId' && (
        <div className="gs-status gs-error">
          {t('google.missingClientId')}
        </div>
      )}
      {status === 'scriptError' && (
        <div className="gs-status gs-error">
          {t('google.scriptLoadError')}
        </div>
      )}
      {showModal && (
        <OtpModal
          target={email}
          onClose={() => setShowModal(false)}
          onSubmit={verify}
        />
      )}
    </>
  );
}
