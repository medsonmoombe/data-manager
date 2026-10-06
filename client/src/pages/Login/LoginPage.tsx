import React, { useState } from 'react';
import { message } from 'antd';
import { EyeOutlined, EyeInvisibleOutlined, ArrowRightOutlined } from '@ant-design/icons';
import {
  FiUser, FiLock, FiShield, FiDatabase, FiGitBranch,
  FiBarChart2, FiSearch, FiMessageCircle, FiCheckCircle
} from 'react-icons/fi';

import { authApi } from '../../api/auth.api';
import { useAuthStore } from '../../stores/auth.store';
import { useNavigate, useSearchParams } from 'react-router-dom';

export default function LoginPage() {
  const [loading, setLoading] = useState(false);
  const [showPw, setShowPw] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<{ username?: string; password?: string }>({});
  const setAuth = useAuthStore((s) => s.setAuth);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const orgSlug = searchParams.get('org');
  const isInvitation = searchParams.get('invitation') === 'true';
  const inviteEmail = searchParams.get('email');

  const verified = searchParams.get('verified');
  const registered = searchParams.get('registered');

  const validate = () => {
    const e: { username?: string; password?: string } = {};
    if (!username.trim()) e.username = 'Email is required';
    if (!password) e.password = 'Password is required';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setLoading(true);
    try {
      const response = await authApi.login(username.trim(), password) as any;

      // Check if 2FA is required
      if (response.requires2FA) {
        navigate(`/2fa?sessionId=${response.sessionId}&email=${encodeURIComponent(response.email)}`);
        return;
      }

      // Login successful — store tokens and user
      setAuth(response.accessToken, response.refreshToken, response.user);
      message.success(`Welcome back, ${response.user?.given_name || response.user?.preferred_username || 'User'}`);

      // Check for required actions (e.g., UPDATE_PASSWORD)
      const requiredActions = response.user?.required_actions || [];
      if (requiredActions.includes('UPDATE_PASSWORD')) {
        navigate('/change-password');
        return;
      }

      navigate('/org-select');
    } catch (err: any) {
      const msg = err?.response?.data?.message || err.message || 'Invalid credentials.';
      message.error(msg);
    } finally {
      setLoading(false);
    }
  };

  const features = [
    { Icon: FiDatabase, text: 'Master data management with intelligent deduplication' },
    { Icon: FiGitBranch, text: 'Workflow automation engine with multi-step approvals' },
    { Icon: FiBarChart2, text: 'Real-time dashboards, KPIs & narrative report generation' },
    { Icon: FiSearch, text: 'AI-powered anomaly detection & fraud prevention' },
    { Icon: FiMessageCircle, text: 'WhatsApp chatbot for field data collection & verification' },
    { Icon: FiShield, text: 'Enterprise-grade security — SOC 2, POPIA, TLS 1.3, MFA' },
  ];

  return (
    <div className="h-screen flex items-center justify-center bg-[#F3F4F8] relative overflow-hidden p-3">
      {/* BG decorations */}
      <div className="absolute -top-[120px] -right-[120px] w-[400px] h-[400px] rounded-full pointer-events-none"
        style={{ background: 'radial-gradient(circle, rgba(0,155,58,0.06) 0%, transparent 70%)' }} />
      <div className="absolute -bottom-[80px] -left-[80px] w-[300px] h-[300px] rounded-full pointer-events-none"
        style={{ background: 'radial-gradient(circle, rgba(232,97,29,0.04) 0%, transparent 70%)' }} />

      <div className="flex w-[90vw] max-w-[1050px] h-[90vh] max-h-[600px] bg-white rounded-2xl overflow-hidden shadow-[0_8px_40px_rgba(0,0,0,0.08)] relative z-10">

        {/* LEFT PANEL */}
        <div className="w-[44%] flex-shrink-0 relative overflow-hidden flex flex-col justify-between px-8 py-8"
          style={{ background: 'linear-gradient(160deg, #007A2E 0%, #009B3A 40%, #006828 100%)' }}>

          <div className="absolute -bottom-[60px] -right-[60px] w-[200px] h-[200px] rounded-full" style={{ background: 'rgba(232,97,29,0.12)' }} />
          <div className="absolute top-[18%] -right-[25px] w-[60px] h-[60px] rounded-full" style={{ background: 'rgba(255,255,255,0.04)' }} />
          <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,0.3) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.3) 1px, transparent 1px)', backgroundSize: '40px 40px' }} />

          <div className="relative z-10">
            <div className="flex items-center gap-2.5 mb-6">
              <div className="w-10 h-10 rounded-[10px] flex items-center justify-center text-white font-bold text-base" style={{ background: 'rgba(255,255,255,0.18)', border: '1px solid rgba(255,255,255,0.08)' }}>OC</div>
              <span className="text-lg font-bold text-white tracking-tight">OmniCore<span style={{ color: '#F58342' }}> Africa</span></span>
            </div>

            <h1 className="text-[24px] font-bold text-white leading-tight mb-3 tracking-tight">
              The Data Infrastructure<br />for Africa's Future
            </h1>
            <p className="text-[11px] text-white/60 leading-relaxed max-w-[360px]">
              OmniCore Africa unifies fragmented data across departments and sectors into a single,
              trusted platform. From master data management and workflow automation to real-time
              analytics and AI-powered insights — we help governments, NGOs, and enterprises
              make faster, better decisions.
            </p>

            <div className="mt-5 flex flex-col gap-2.5">
              {features.slice(0, 4).map(({ Icon, text }, i) => (
                <div key={i} className="flex items-start gap-2.5 text-[10.5px] text-white/55">
                  <FiCheckCircle className="text-[11px] text-[#4ADE80] flex-shrink-0 mt-0.5" />
                  <span>{text}</span>
                </div>
              ))}
            </div>

            <div className="h-[3px] rounded-sm mt-6 opacity-45" style={{ background: 'linear-gradient(90deg, #fff 0%, #fff 35%, #CE1126 35%, #CE1126 55%, #1A1A1A 55%, #1A1A1A 75%, #E8611D 75%, #E8611D 100%)' }} />
          </div>

          <div className="flex gap-8 relative z-10">
            {[{ v: '50K+', l: 'Records Managed' }, { v: '99.9%', l: 'Platform Uptime' }, { v: 'SOC 2', l: 'Certified' }].map((s, i) => (
              <div key={i}>
                <div className="text-lg font-bold text-white">{s.v}</div>
                <div className="text-[9px] text-white/45 mt-0.5">{s.l}</div>
              </div>
            ))}
          </div>
        </div>

        {/* RIGHT PANEL */}
        <div className="flex-1 flex flex-col justify-center px-10 py-6">
          <div className="mb-6">
            {isInvitation && orgSlug && (
              <div className="bg-[#F0FDF4] border border-[#86EFAC] rounded-lg p-3 mb-4 max-w-[400px]">
                <p className="text-[11px] text-[#007A2E] font-medium">
                  You've been invited to join an organization.
                </p>
                {inviteEmail && (
                  <p className="text-[10px] text-[#5F6880] mt-1">
                    Sign in as <strong>{inviteEmail}</strong> to accept the invitation.
                    You'll be asked to set a new password.
                  </p>
                )}
              </div>
            )}
            {registered === 'true' && (
              <div className="bg-[#F0FDF4] border border-[#86EFAC] rounded-lg p-3 mb-4 max-w-[400px]">
                <p className="text-[11px] text-[#007A2E] font-medium">
                  Organization created! Check your email to verify your account.
                </p>
              </div>
            )}
            {verified === 'true' && (
              <div className="bg-[#F0FDF4] border border-[#86EFAC] rounded-lg p-3 mb-4 max-w-[400px]">
                <p className="text-[11px] text-[#007A2E] font-medium">
                  Email verified successfully. You can now sign in.
                </p>
              </div>
            )}
            <div className="text-[10px] font-semibold text-[#E8611D] uppercase tracking-widest mb-1">Welcome back</div>
            <h2 className="text-[22px] font-bold text-[#1A1F2E] tracking-tight">Sign in to your workspace</h2>
            <p className="text-[11px] text-[#99A1B3] mt-0.5">Enter your credentials to continue</p>
          </div>

          <form onSubmit={handleSubmit} noValidate autoComplete="off" className="flex flex-col gap-3 max-w-[400px]">
            <div>
              <label className="block text-[9.5px] font-semibold text-[#5F6880] uppercase tracking-wide mb-1">Email</label>
              <div className="relative">
                <FiUser className="absolute left-3 top-1/2 -translate-y-1/2 text-[#99A1B3] text-xs" />
                <input type="email" value={username} onChange={(e) => { setUsername(e.target.value); setErrors({}); }}
                  placeholder="Enter your email" autoComplete="email"
                  className={`w-full h-[40px] pl-9 pr-3 border rounded-[9px] text-[12px] font-medium text-[#1A1F2E] bg-[#F7F8FA] outline-none transition-all placeholder:text-[#99A1B3] ${errors.username ? 'border-[#CE1126]' : 'border-[#E3E7EE] focus:border-[#009B3A] focus:bg-white'}`} />
              </div>
              {errors.username && <p className="text-[9px] text-[#CE1126] mt-1">{errors.username}</p>}
            </div>

            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="text-[9.5px] font-semibold text-[#5F6880] uppercase tracking-wide">Password</label>
                <button type="button" onClick={() => navigate('/forgot-password')} className="text-[9px] text-[#009B3A] font-semibold bg-transparent border-none p-0 cursor-pointer hover:underline">
                  Forgot?
                </button>
              </div>
              <div className="relative">
                <FiLock className="absolute left-3 top-1/2 -translate-y-1/2 text-[#99A1B3] text-xs" />
                <input type={showPw ? 'text' : 'password'} value={password} onChange={(e) => { setPassword(e.target.value); setErrors({}); }}
                  placeholder="Enter your password" autoComplete="current-password"
                  className={`w-full h-[40px] pl-9 pr-10 border rounded-[9px] text-[12px] font-medium text-[#1A1F2E] bg-[#F7F8FA] outline-none transition-all placeholder:text-[#99A1B3] ${errors.password ? 'border-[#CE1126]' : 'border-[#E3E7EE] focus:border-[#009B3A] focus:bg-white'}`} />
                <button type="button" onClick={() => setShowPw(!showPw)} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#99A1B3] hover:text-[#5F6880] p-1 cursor-pointer" tabIndex={-1}>
                  {showPw ? <EyeInvisibleOutlined className="text-xs" /> : <EyeOutlined className="text-xs" />}
                </button>
              </div>
              {errors.password && <p className="text-[9px] text-[#CE1126] mt-1">{errors.password}</p>}
            </div>

            <div className="flex items-center gap-1.5">
              <input type="checkbox" id="rm" defaultChecked className="w-3 h-3 accent-[#009B3A]" />
              <label htmlFor="rm" className="text-[10px] text-[#5F6880] cursor-pointer">Remember me</label>
            </div>

            <button type="submit" disabled={loading}
              className="w-full h-[42px] bg-[#009B3A] text-white rounded-[9px] text-[12px] font-bold cursor-pointer transition-all hover:bg-[#007A2E] disabled:opacity-60 shadow-[0_2px_10px_rgba(0,155,58,0.22)] flex items-center justify-center gap-2">
              {loading ? <span className="inline-block w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <><ArrowRightOutlined className="text-xs" /> Sign In</>}
            </button>

            <p className="text-[10px] text-[#99A1B3] text-center m-0">
              Don't have an account?{' '}
              <button type="button" onClick={() => navigate('/register')}
                className="text-[#009B3A] font-semibold bg-transparent border-none p-0 cursor-pointer hover:underline text-[10px]">
                Register your organization
              </button>
            </p>
          </form>

          <div className="mt-5 max-w-[400px]">
            <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[9px] font-semibold text-[#007A2E] uppercase tracking-wide" style={{ background: 'rgba(0,155,58,0.06)', border: '1px solid rgba(0,155,58,0.12)' }}>
              <FiShield className="text-[9px]" /> Secure Authentication
            </div>
            <p className="text-[9px] text-[#99A1B3] mt-2 leading-relaxed">TLS 1.3 &nbsp;•&nbsp; MFA Ready &nbsp;•&nbsp; SOC 2 Type II &nbsp;•&nbsp; POPIA Compliant</p>
          </div>
        </div>
      </div>
    </div>
  );
}
