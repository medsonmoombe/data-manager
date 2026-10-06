import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { message } from 'antd';
import { FiMail, FiArrowRight, FiShield, FiArrowLeft } from 'react-icons/fi';
import { authApi } from '../../api/auth.api';

/**
 * Forgot Password Page
 *
 * User enters their email address to request a password reset link.
 * Shows a success message regardless of whether the email exists (security).
 *
 * URL: /forgot-password
 */
export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const validate = () => {
    if (!email.trim()) {
      setError('Email is required');
      return false;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError('Please enter a valid email address');
      return false;
    }
    setError('');
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    setLoading(true);
    try {
      await authApi.forgotPassword(email.trim());
      setSent(true);
    } catch (err: any) {
      const msg = err?.response?.data?.message || err.message || 'Something went wrong. Please try again.';
      message.error(msg);
    } finally {
      setLoading(false);
    }
  };

  // Success state
  if (sent) {
    return (
      <div className="h-screen flex items-center justify-center bg-[#F3F4F8] relative overflow-hidden p-3">
        <div className="absolute -top-[120px] -right-[120px] w-[400px] h-[400px] rounded-full pointer-events-none"
          style={{ background: 'radial-gradient(circle, rgba(0,155,58,0.06) 0%, transparent 70%)' }} />

        <div className="bg-white rounded-2xl p-10 max-w-[480px] w-full text-center shadow-[0_8px_40px_rgba(0,0,0,0.08)] relative z-10">
          <div className="w-16 h-16 bg-[rgba(0,155,58,0.1)] rounded-full flex items-center justify-center mx-auto mb-5">
            <FiMail className="text-2xl text-[#009B3A]" />
          </div>
          <h2 className="text-[20px] font-bold text-[#1A1F2E] tracking-tight mb-2">Check Your Email</h2>
          <p className="text-[13px] text-[#5F6880] mb-2 leading-relaxed">
            If an account exists with <strong className="text-[#1A1F2E]">{email}</strong>,
            we've sent a password reset link.
          </p>
          <p className="text-[11px] text-[#99A1B3] mb-6">
            The link will expire in 1 hour. Check your spam folder if you don't see it.
          </p>
          <button
            onClick={() => navigate('/login')}
            className="inline-flex items-center gap-1.5 h-[42px] px-6 bg-[#009B3A] text-white rounded-[9px] text-[12px] font-bold hover:bg-[#007A2E] transition-all cursor-pointer border-none"
          >
            <FiArrowLeft className="text-xs" /> Back to Login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex items-center justify-center bg-[#F3F4F8] relative overflow-hidden p-3">
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
              Forgot Your<br />Password?
            </h1>
            <p className="text-[11px] text-white/60 leading-relaxed max-w-[300px]">
              No worries. Enter your email address and we'll send you a link to reset your password.
            </p>
          </div>

          <div className="flex gap-6 relative z-10">
            {[{ v: 'Secure', l: 'Reset Process' }, { v: '1 Hour', l: 'Link Expiry' }, { v: 'AES-256', l: 'Encrypted' }].map((s, i) => (
              <div key={i}>
                <div className="text-lg font-bold text-white">{s.v}</div>
                <div className="text-[9px] text-white/45 mt-0.5">{s.l}</div>
              </div>
            ))}
          </div>
        </div>

        {/* RIGHT PANEL */}
        <div className="flex-1 flex flex-col justify-center px-10 py-8">
          <div className="w-full max-w-[380px]">
            <div className="mb-6">
              <div className="text-[10px] font-semibold text-[#E8611D] uppercase tracking-widest mb-1">Password recovery</div>
              <h2 className="text-[22px] font-bold text-[#1A1F2E] tracking-tight">Reset your password</h2>
              <p className="text-[11px] text-[#99A1B3] mt-0.5">Enter the email associated with your account</p>
            </div>

            <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-3">
              <div>
                <label className="block text-[9.5px] font-semibold text-[#5F6880] uppercase tracking-wide mb-1">Email Address</label>
                <div className="relative">
                  <FiMail className="absolute left-3 top-1/2 -translate-y-1/2 text-[#99A1B3] text-xs" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => { setEmail(e.target.value); setError(''); }}
                    placeholder="admin@yourorg.org"
                    autoComplete="email"
                    className={`w-full h-[40px] pl-9 pr-3 border rounded-[9px] text-[12px] font-medium text-[#1A1F2E] bg-[#F7F8FA] outline-none transition-all placeholder:text-[#99A1B3] ${error ? 'border-[#CE1126]' : 'border-[#E3E7EE] focus:border-[#009B3A] focus:bg-white'}`}
                  />
                </div>
                {error && <p className="text-[9px] text-[#CE1126] mt-1">{error}</p>}
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full h-[42px] bg-[#009B3A] text-white rounded-[9px] text-[12px] font-bold cursor-pointer transition-all hover:bg-[#007A2E] disabled:opacity-60 shadow-[0_2px_10px_rgba(0,155,58,0.22)] flex items-center justify-center gap-2"
              >
                {loading ? (
                  <span className="inline-block w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <><FiArrowRight className="text-xs" /> Send Reset Link</>
                )}
              </button>

              <button
                type="button"
                onClick={() => navigate('/login')}
                className="w-full h-[36px] bg-transparent border border-[#E3E7EE] text-[#5F6880] rounded-[9px] text-[11px] font-semibold cursor-pointer transition-all hover:bg-[#F7F8FA] hover:border-[#99A1B3] flex items-center justify-center gap-1.5"
              >
                <FiArrowLeft className="text-[10px]" /> Back to Login
              </button>
            </form>

            <div className="mt-5">
              <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[9px] font-semibold text-[#007A2E] uppercase tracking-wide" style={{ background: 'rgba(0,155,58,0.06)', border: '1px solid rgba(0,155,58,0.12)' }}>
                <FiShield className="text-[9px]" /> Secure Reset
              </div>
              <p className="text-[9px] text-[#99A1B3] mt-2 leading-relaxed">Reset links expire in 1 hour for your security.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
