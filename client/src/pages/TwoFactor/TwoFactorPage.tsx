import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { message } from 'antd';
import { FiShield, FiArrowRight, FiRefreshCw } from 'react-icons/fi';
import { authApi } from '../../api/auth.api';
import { useAuthStore } from '../../stores/auth.store';

/**
 * Two-Factor Authentication Page
 *
 * Shown when a user has 2FA enabled. They enter a 6-digit code
 * sent to their email to complete the login process.
 *
 * URL: /2fa?sessionId=xxx&email=xxx
 */
export default function TwoFactorPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const setAuth = useAuthStore((s) => s.setAuth);

  const sessionId = searchParams.get('sessionId');
  const email = searchParams.get('email') || '';

  const [code, setCode] = useState(['', '', '', '', '', '']);
  const [loading, setLoading] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);
  const [resendTimer, setResendTimer] = useState(60);
  const [error, setError] = useState('');
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Redirect if no session
  useEffect(() => {
    if (!sessionId) {
      navigate('/login', { replace: true });
    }
  }, [sessionId, navigate]);

  // Resend countdown timer
  useEffect(() => {
    if (resendTimer <= 0) return;
    const timer = setInterval(() => setResendTimer((t) => t - 1), 1000);
    return () => clearInterval(timer);
  }, [resendTimer]);

  // Auto-focus first input
  useEffect(() => {
    inputRefs.current[0]?.focus();
  }, []);

  const handleCodeChange = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return;

    const newCode = [...code];
    newCode[index] = value.slice(-1);
    setCode(newCode);
    setError('');

    // Auto-advance to next input
    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }

    // Auto-submit when all 6 digits entered
    if (value && index === 5) {
      const fullCode = newCode.join('');
      if (fullCode.length === 6) {
        handleVerify(fullCode);
      }
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !code[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (pasted.length === 6) {
      const newCode = pasted.split('');
      setCode(newCode);
      handleVerify(pasted);
    }
  };

  const handleVerify = async (fullCode?: string) => {
    const codeToVerify = fullCode || code.join('');
    if (codeToVerify.length !== 6 || !sessionId) return;

    setLoading(true);
    try {
      const response = await authApi.verify2FA(sessionId, codeToVerify) as any;
      setAuth(response.accessToken, response.refreshToken, response.user);
      message.success(`Welcome back, ${response.user?.given_name || response.user?.preferred_username || 'User'}`);
      navigate('/org-select');
    } catch (err: any) {
      const msg = err?.response?.data?.message || err.message || 'Invalid code. Please try again.';
      setError(msg);
      setCode(['', '', '', '', '', '']);
      inputRefs.current[0]?.focus();
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (!sessionId || !email || resendTimer > 0) return;

    setResendLoading(true);
    try {
      await authApi.resend2FA(sessionId, email);
      message.success('New verification code sent to your email.');
      setResendTimer(60);
    } catch (err: any) {
      message.error(err?.response?.data?.message || 'Failed to resend code.');
    } finally {
      setResendLoading(false);
    }
  };

  return (
    <div className="h-screen flex items-center justify-center bg-[#F3F4F8] relative overflow-hidden p-3">
      {/* Background decorations */}
      <div className="absolute -top-[120px] -right-[120px] w-[400px] h-[400px] rounded-full pointer-events-none"
        style={{ background: 'radial-gradient(circle, rgba(0,155,58,0.06) 0%, transparent 70%)' }} />
      <div className="absolute -bottom-[80px] -left-[80px] w-[300px] h-[300px] rounded-full pointer-events-none"
        style={{ background: 'radial-gradient(circle, rgba(232,97,29,0.04) 0%, transparent 70%)' }} />

      <div className="flex w-[90vw] max-w-[850px] min-h-[500px] bg-white rounded-2xl overflow-hidden shadow-[0_8px_40px_rgba(0,0,0,0.08)] relative z-10">

        {/* LEFT PANEL */}
        <div className="w-[40%] flex-shrink-0 relative overflow-hidden flex flex-col justify-between px-8 py-8"
          style={{ background: 'linear-gradient(160deg, #007A2E 0%, #009B3A 40%, #006828 100%)' }}>

          <div className="absolute -bottom-[60px] -right-[60px] w-[200px] h-[200px] rounded-full" style={{ background: 'rgba(232,97,29,0.12)' }} />
          <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,0.3) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.3) 1px, transparent 1px)', backgroundSize: '40px 40px' }} />

          <div className="relative z-10">
            <div className="flex items-center gap-2.5 mb-6">
              <div className="w-10 h-10 rounded-[10px] flex items-center justify-center text-white font-bold text-base" style={{ background: 'rgba(255,255,255,0.18)', border: '1px solid rgba(255,255,255,0.08)' }}>OC</div>
              <span className="text-lg font-bold text-white tracking-tight">OmniCore<span style={{ color: '#F58342' }}> Africa</span></span>
            </div>
            <h1 className="text-[24px] font-bold text-white leading-tight mb-3 tracking-tight">
              Two-Factor<br />Authentication
            </h1>
            <p className="text-[11px] text-white/60 leading-relaxed max-w-[300px]">
              For your security, we've sent a verification code to your email address.
              Enter the 6-digit code to complete sign-in.
            </p>
          </div>

          <div className="flex gap-6 relative z-10">
            {[{ v: '2FA', l: 'Enabled' }, { v: 'AES-256', l: 'Encrypted' }, { v: 'SOC 2', l: 'Certified' }].map((s, i) => (
              <div key={i}>
                <div className="text-lg font-bold text-white">{s.v}</div>
                <div className="text-[9px] text-white/45 mt-0.5">{s.l}</div>
              </div>
            ))}
          </div>
        </div>

        {/* RIGHT PANEL */}
        <div className="flex-1 flex flex-col justify-center items-center px-10 py-8">
          <div className="w-full max-w-[340px]">
            <div className="flex items-center justify-center w-14 h-14 rounded-full bg-[rgba(0,155,58,0.08)] mx-auto mb-5">
              <FiShield className="text-xl text-[#009B3A]" />
            </div>

            <div className="text-center mb-6">
              <div className="text-[10px] font-semibold text-[#E8611D] uppercase tracking-widest mb-1">Security verification</div>
              <h2 className="text-[20px] font-bold text-[#1A1F2E] tracking-tight">Enter verification code</h2>
              <p className="text-[11px] text-[#99A1B3] mt-1">
                Code sent to <strong className="text-[#5F6880]">{email || 'your email'}</strong>
              </p>
            </div>

            {/* 6-digit code input */}
            <div className="flex justify-center gap-2.5 mb-4" onPaste={handlePaste}>
              {code.map((digit, index) => (
                <input
                  key={index}
                  ref={(el) => { inputRefs.current[index] = el; }}
                  type="text"
                  inputMode="numeric"
                  maxLength={1}
                  value={digit}
                  onChange={(e) => handleCodeChange(index, e.target.value)}
                  onKeyDown={(e) => handleKeyDown(index, e)}
                  className={`w-[46px] h-[52px] text-center text-xl font-bold rounded-[10px] border-2 outline-none transition-all bg-[#F7F8FA] text-[#1A1F2E] ${
                    error ? 'border-[#CE1126]' : digit ? 'border-[#009B3A] bg-white' : 'border-[#E3E7EE] focus:border-[#009B3A] focus:bg-white'
                  }`}
                  autoFocus={index === 0}
                />
              ))}
            </div>

            {error && (
              <p className="text-[10px] text-[#CE1126] text-center mb-3 font-medium">{error}</p>
            )}

            {/* Verify button */}
            <button
              onClick={() => handleVerify()}
              disabled={loading || code.join('').length !== 6}
              className="w-full h-[42px] bg-[#009B3A] text-white rounded-[9px] text-[12px] font-bold cursor-pointer transition-all hover:bg-[#007A2E] disabled:opacity-60 shadow-[0_2px_10px_rgba(0,155,58,0.22)] flex items-center justify-center gap-2"
            >
              {loading ? (
                <span className="inline-block w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <><FiArrowRight className="text-xs" /> Verify & Sign In</>
              )}
            </button>

            {/* Resend code */}
            <div className="text-center mt-5">
              {resendTimer > 0 ? (
                <p className="text-[11px] text-[#99A1B3]">
                  Resend code in <strong className="text-[#5F6880]">{resendTimer}s</strong>
                </p>
              ) : (
                <button
                  onClick={handleResend}
                  disabled={resendLoading}
                  className="text-[11px] text-[#009B3A] font-semibold bg-transparent border-none cursor-pointer hover:underline flex items-center gap-1.5 mx-auto"
                >
                  <FiRefreshCw className={`text-[10px] ${resendLoading ? 'animate-spin' : ''}`} />
                  Resend verification code
                </button>
              )}
            </div>

            <button
              onClick={() => navigate('/login')}
              className="w-full mt-4 h-[36px] bg-transparent border border-[#E3E7EE] text-[#5F6880] rounded-[9px] text-[11px] font-semibold cursor-pointer transition-all hover:bg-[#F7F8FA] hover:border-[#99A1B3]"
            >
              Back to Login
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
