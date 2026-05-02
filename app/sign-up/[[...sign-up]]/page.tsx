import { SignUp } from '@clerk/nextjs';

export default function SignUpPage() {
  return (
    <div className="tx-auth-page">
      <div className="tx-auth-wordmark">
        Translator<span className="tx-wordmark-dot">.</span>
      </div>
      <p className="tx-auth-sub">No password needed — just your email.</p>
      <SignUp
        appearance={{
          variables: {
            colorPrimary: '#e8a045',
            colorBackground: '#fffdf8',
            colorText: '#1a1a2e',
            colorTextSecondary: '#5c5c7a',
            colorInputBackground: '#ffffff',
            colorInputText: '#1a1a2e',
            borderRadius: '14px',
            fontFamily: 'inherit',
            fontSize: '16px',
          },
        }}
      />
    </div>
  );
}
