import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { message } from 'antd';
import { ArrowRightOutlined, EyeOutlined, EyeInvisibleOutlined } from '@ant-design/icons';
import {
  FiUser, FiMail, FiLock, FiHome, FiShield, FiDatabase, FiGitBranch,
  FiBarChart2, FiSearch, FiMessageCircle,
} from 'react-icons/fi';
import api from '../../api/axios';
import { useAuthStore } from '../../stores/auth.store';
import { showApiErrors } from '../../utils/api-errors';

const features = [
  { Icon: FiShield, text: 'Government-grade security & compliance (POPIA, SOC 2)' },
  { Icon: FiDatabase, text: 'Multi-entity master data management with deduplication' },
  { Icon: FiGitBranch, text: 'Visual workflow automation engine with approvals' },
  { Icon: FiBarChart2, text: 'Real-time analytics, dashboards & narrative reports' },
  { Icon: FiSearch, text: 'AI-powered anomaly detection & fraud prevention' },
  { Icon: FiMessageCircle, text: 'WhatsApp chatbot for field data collection' },
];

export default function RegisterPage() {
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    organizationName: '',
    adminFirstName: '',
    adminLastName: '',
    email: '',
    password: '',
    confirmPassword: '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [showPw, setShowPw] = useState(false);
  const [showConfirmPw, setShowConfirmPw] = useState(false);
  const [success, setSuccess] = useState(false);
  const navigate = useNavigate();
  const setAuth = useAuthStore((s) => s.setAuth);

  const validate = () => {
    const e: Record<string, string> = {};
    if (!form.organizationName.trim()) e.organizationName = 'Organization name is required';
    if (!form.adminFirstName.trim()) e.adminFirstName = 'First name is required';
    if (!form.email.trim()) e.email = 'Email is required';
    if (!form.password) e.password = 'Password is required';
    else if (form.password.length < 8) e.password = 'Password must be at least 8 characters';
    if (form.password !== form.confirmPassword) e.confirmPassword = 'Passwords do not match';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    setLoading(true);
    try {
      await api.post('/auth/register', {
        organizationName: form.organizationName,
        adminFirstName: form.adminFirstName,
        adminLastName: form.adminLastName,
        email: form.email,
        password: form.password,
      });
      // Auto-login after registration
      const loginRes = await api.post('/auth/api/login', {
        username: form.email,
        password: form.password,
      }) as any;
      const session = loginRes.data;
      setAuth(session.accessToken, session.refreshToken, session.user);
      message.success('Organization created! Welcome to OmniCore Africa.');
      navigate('/dashboard');
    } catch (err: any) {
      showApiErrors(err);
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F3F4F8] p-4">
        <div className="bg-white rounded-2xl p-10 max-w-[500px] w-full text-center shadow-lg">
          <div className="w-16 h-16 bg-[rgba(0,155,58,0.1)] rounded-full flex items-center justify-center mx-auto mb-4">
            <FiMail className="text-2xl text-[#009B3A]" />
          </div>
          <h2 className="text-xl font-bold text-[#1A1F2E] font-[Space_Grotesk] mb-2">Check Your Email</h2>
          <p className="text-sm text-[#5F6880] mb-4">
            We've sent a verification email to <strong className="text-[#1A1F2E]">{form.email}</strong>.
            Click the link in the email to activate your account.
          </p>
          <p className="text-xs text-[#99A1B3] mb-6">
            Didn't receive the email? Check your spam folder or contact support.
          </p>
          <Link to="/login"
            className="inline-flex items-center gap-1.5 h-[36px] px-4 bg-[#009B3A] text-white rounded-[9px] text-[11px] font-bold hover:bg-[#007A2E] transition-all no-underline">
            Go to Login <ArrowRightOutlined className="text-xs" />
          </Link>
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

      <div className="flex w-[90vw] max-w-[1050px] h-[90vh] max-h-[650px] bg-white rounded-2xl overflow-hidden shadow-[0_8px_40px_rgba(0,0,0,0.08)] relative z-10">

        {/* LEFT PANEL */}
        <div className="w-[44%] flex-shrink-0 relative overflow-hidden flex flex-col justify-between px-8 py-8"
          style={{ background: 'linear-gradient(160deg, #007A2E 0%, #009B3A 40%, #006828 100%)' }}>

          <div className="absolute -bottom-[60px] -right-[60px] w-[200px] h-[200px] rounded-full" style={{ background: 'rgba(232,97,29,0.12)' }} />
          <div className="absolute top-[18%] -right-[25px] w-[60px] h-[60px] rounded-full" style={{ background: 'rgba(255,255,255,0.04)' }} />
          <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,0.3) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.3) 1px, transparent 1px)', backgroundSize: '40px 40px' }} />

          <div className="relative z-10">
            <div className="flex items-center gap-2.5 mb-6">
              <div className="w-10 h-10 rounded-[10px] flex items-center justify-center text-white font-bold text-base font-[Space_Grotesk]" style={{ background: 'rgba(255,255,255,0.18)', border: '1px solid rgba(255,255,255,0.08)' }}>OC</div>
              <span className="text-lg font-bold text-white tracking-tight font-[Space_Grotesk]">OmniCore<span className="text-[#F58342]"> Africa</span></span>
            </div>

            <h1 className="text-[24px] font-bold text-white leading-tight mb-2 tracking-tight">
              Africa's Most Advanced<br />Enterprise Data Platform
            </h1>
            <p className="text-[11px] text-white/60 leading-relaxed max-w-[360px]">
              Unify your data across departments. Automate workflows. Generate insights.
              Built for government, NGOs, and enterprise.
            </p>

            <div className="mt-6 flex flex-col gap-2">
              {features.slice(0, 5).map(({ Icon, text }, i) => (
                <div key={i} className="flex items-center gap-2.5 text-[10.5px] text-white/55">
                  <Icon className="text-[13px] text-white/30 flex-shrink-0" />
                  <span>{text}</span>
                </div>
              ))}
            </div>

            <div className="h-[3px] rounded-sm mt-6 opacity-45" style={{ background: 'linear-gradient(90deg, #fff 0%, #fff 35%, #CE1126 35%, #CE1126 55%, #1A1A1A 55%, #1A1A1A 75%, #E8611D 75%, #E8611D 100%)' }} />
          </div>

          <div className="flex gap-6 relative z-10">
            {[{ v: '50K+', l: 'Records' }, { v: '99.9%', l: 'Uptime' }, { v: 'SOC 2', l: 'Certified' }].map((s, i) => (
              <div key={i}>
                <div className="text-lg font-bold text-white font-[Space_Grotesk]">{s.v}</div>
                <div className="text-[9px] text-white/45 mt-0.5">{s.l}</div>
              </div>
            ))}
          </div>
        </div>

        {/* RIGHT PANEL */}
        <div className="flex-1 flex flex-col justify-center px-10 py-6 overflow-y-auto">
          <div className="mb-4">
            <div className="text-[10px] font-semibold text-[#E8611D] uppercase tracking-widest mb-1">Get started</div>
            <h2 className="text-[22px] font-bold text-[#1A1F2E] font-[Space_Grotesk] tracking-tight">Create your organization</h2>
            <p className="text-[11px] text-[#99A1B3] mt-0.5">Set up your workspace on OmniCore Africa</p>
          </div>

          <form onSubmit={handleSubmit} noValidate autoComplete="off" className="flex flex-col gap-2.5 max-w-[400px]">
            <div>
              <label className="block text-[9.5px] font-semibold text-[#5F6880] uppercase tracking-wide mb-1">Organization Name</label>
              <div className="relative">
                <FiHome className="absolute left-3 top-1/2 -translate-y-1/2 text-[#99A1B3] text-xs" />
                <input type="text" value={form.organizationName} onChange={(e) => { setForm({...form, organizationName: e.target.value}); setErrors({}); }}
                  placeholder="e.g. Zambia Health Initiative" autoComplete="organization"
                  className={`w-full h-[40px] pl-9 pr-3 border rounded-[9px] text-[12px] font-medium text-[#1A1F2E] bg-[#F7F8FA] outline-none transition-all font-[DM_Sans] placeholder:text-[#99A1B3] ${errors.organizationName ? 'border-[#CE1126]' : 'border-[#E3E7EE] focus:border-[#009B3A] focus:bg-white'}`} />
              </div>
              {errors.organizationName && <p className="text-[9px] text-[#CE1126] mt-1">{errors.organizationName}</p>}
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label className="block text-[9.5px] font-semibold text-[#5F6880] uppercase tracking-wide mb-1">First Name</label>
                <input type="text" value={form.adminFirstName} onChange={(e) => { setForm({...form, adminFirstName: e.target.value}); setErrors({}); }}
                  placeholder="First name" autoComplete="given-name"
                  className={`w-full h-[40px] px-3 border rounded-[9px] text-[12px] font-medium text-[#1A1F2E] bg-[#F7F8FA] outline-none transition-all font-[DM_Sans] placeholder:text-[#99A1B3] ${errors.adminFirstName ? 'border-[#CE1126]' : 'border-[#E3E7EE] focus:border-[#009B3A] focus:bg-white'}`} />
                {errors.adminFirstName && <p className="text-[9px] text-[#CE1126] mt-1">{errors.adminFirstName}</p>}
              </div>
              <div>
                <label className="block text-[9.5px] font-semibold text-[#5F6880] uppercase tracking-wide mb-1">Last Name</label>
                <input type="text" value={form.adminLastName} onChange={(e) => setForm({...form, adminLastName: e.target.value})}
                  placeholder="Last name" autoComplete="family-name"
                  className="w-full h-[40px] px-3 border border-[#E3E7EE] rounded-[9px] text-[12px] font-medium text-[#1A1F2E] bg-[#F7F8FA] outline-none transition-all font-[DM_Sans] placeholder:text-[#99A1B3] focus:border-[#009B3A] focus:bg-white" />
              </div>
            </div>

            <div>
              <label className="block text-[9.5px] font-semibold text-[#5F6880] uppercase tracking-wide mb-1">Email Address</label>
              <div className="relative">
                <FiMail className="absolute left-3 top-1/2 -translate-y-1/2 text-[#99A1B3] text-xs" />
                <input type="email" value={form.email} onChange={(e) => { setForm({...form, email: e.target.value}); setErrors({}); }}
                  placeholder="admin@yourorg.org" autoComplete="email"
                  className={`w-full h-[40px] pl-9 pr-3 border rounded-[9px] text-[12px] font-medium text-[#1A1F2E] bg-[#F7F8FA] outline-none transition-all font-[DM_Sans] placeholder:text-[#99A1B3] ${errors.email ? 'border-[#CE1126]' : 'border-[#E3E7EE] focus:border-[#009B3A] focus:bg-white'}`} />
              </div>
              {errors.email && <p className="text-[9px] text-[#CE1126] mt-1">{errors.email}</p>}
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label className="block text-[9.5px] font-semibold text-[#5F6880] uppercase tracking-wide mb-1">Password</label>
                <div className="relative">
                  <FiLock className="absolute left-3 top-1/2 -translate-y-1/2 text-[#99A1B3] text-xs" />
                  <input type={showPw ? 'text' : 'password'} value={form.password} onChange={(e) => { setForm({...form, password: e.target.value}); setErrors({}); }}
                    placeholder="Min 8 characters" autoComplete="new-password"
                    className={`w-full h-[40px] pl-9 pr-10 border rounded-[9px] text-[12px] font-medium text-[#1A1F2E] bg-[#F7F8FA] outline-none transition-all font-[DM_Sans] placeholder:text-[#99A1B3] ${errors.password ? 'border-[#CE1126]' : 'border-[#E3E7EE] focus:border-[#009B3A] focus:bg-white'}`} />
                  <button type="button" onClick={() => setShowPw(!showPw)} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#99A1B3] hover:text-[#5F6880] p-1 cursor-pointer bg-transparent border-none" tabIndex={-1}>
                    {showPw ? <EyeInvisibleOutlined className="text-xs" /> : <EyeOutlined className="text-xs" />}
                  </button>
                </div>
                {errors.password && <p className="text-[9px] text-[#CE1126] mt-1">{errors.password}</p>}
              </div>
              <div>
                <label className="block text-[9.5px] font-semibold text-[#5F6880] uppercase tracking-wide mb-1">Confirm Password</label>
                <div className="relative">
                  <FiLock className="absolute left-3 top-1/2 -translate-y-1/2 text-[#99A1B3] text-xs" />
                  <input type={showConfirmPw ? 'text' : 'password'} value={form.confirmPassword} onChange={(e) => { setForm({...form, confirmPassword: e.target.value}); setErrors({}); }}
                    placeholder="Confirm password" autoComplete="new-password"
                    className={`w-full h-[40px] pl-9 pr-10 border rounded-[9px] text-[12px] font-medium text-[#1A1F2E] bg-[#F7F8FA] outline-none transition-all font-[DM_Sans] placeholder:text-[#99A1B3] ${errors.confirmPassword ? 'border-[#CE1126]' : 'border-[#E3E7EE] focus:border-[#009B3A] focus:bg-white'}`} />
                  <button type="button" onClick={() => setShowConfirmPw(!showConfirmPw)} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#99A1B3] hover:text-[#5F6880] p-1 cursor-pointer bg-transparent border-none" tabIndex={-1}>
                    {showConfirmPw ? <EyeInvisibleOutlined className="text-xs" /> : <EyeOutlined className="text-xs" />}
                  </button>
                </div>
                {errors.confirmPassword && <p className="text-[9px] text-[#CE1126] mt-1">{errors.confirmPassword}</p>}
              </div>
            </div>

            <button type="submit" disabled={loading}
              className="w-full h-[42px] bg-[#009B3A] text-white rounded-[9px] text-[12px] font-bold font-[DM_Sans] cursor-pointer transition-all hover:bg-[#007A2E] disabled:opacity-60 shadow-[0_2px_10px_rgba(0,155,58,0.22)] flex items-center justify-center gap-2 mt-1">
              {loading ? (
                <span className="inline-block w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <><ArrowRightOutlined className="text-xs" /> Create Organization</>
              )}
            </button>

            <p className="text-[10px] text-[#99A1B3] text-center m-0 mt-1">
              Already have an account?{' '}
              <Link to="/login" className="text-[#009B3A] font-semibold no-underline hover:underline text-[10px]">
                Sign in
              </Link>
            </p>
          </form>

          <div className="mt-3 max-w-[400px]">
            <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[9px] font-semibold text-[#007A2E] uppercase tracking-wide" style={{ background: 'rgba(0,155,58,0.06)', border: '1px solid rgba(0,155,58,0.12)' }}>
              <FiShield className="text-[9px]" /> Secure Registration
            </div>
            <p className="text-[9px] text-[#99A1B3] mt-2 leading-relaxed">TLS 1.3 &nbsp;•&nbsp; MFA Ready &nbsp;•&nbsp; SOC 2 Type II &nbsp;•&nbsp; POPIA Compliant</p>
          </div>
        </div>
      </div>
    </div>
  );
}
