import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { message } from 'antd';
import { FiLock, FiArrowRight, FiShield, FiCheckCircle } from 'react-icons/fi';
import { EyeOutlined, EyeInvisibleOutlined } from '@ant-design/icons';
import { authApi } from '../../api/auth.api';

/**
 * Reset Password Page
 *
 * User sets a new password after clicking the reset link in their email.
 * The reset token is passed as a URL query parameter.
 *
 * URL: /reset-password?token=xxx
 */
export default function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const token = searchParams.get('token');

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPw, setShowNewPw] = useState(false);
  const [showConfirmPw, setShowConfirmPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [success, setSuccess] = useState(false);

  // Redirect if no token
  useEffect(() => {
    if (!token) {
      navigate('/login', { replace: true });
    }
  }, [token, navigate]);

  const validate = () => {
    const e: Record<string, string> = {};
    if (!newPassword) e.newPassword = 'Password is required';
    else if (newPassword.length < 8) e.newPassword = 'Password must be at least 8 characters';
    else if (!/[A-Z]/.test(newPassword)) e.newPassword = 'Must contain at least one uppercase letter';
    else if (!/[a-z]/.test(newPassword)) e.newPassword = 'Must contain at least one lowercase letter';
    else if (!/[0-9]/.test(newPassword)) e.newPassword = 'Must contain at least one number';
    else if (!/[!@#$%^&*(),.?":{}|<>]/.test(newPassword)) e.newPassword = 'Must contain at least one special character';

    if (!confirmPassword) e.confirmPassword = 'Please confirm your password';
    else if (newPassword !== confirmPassword) e.confirmPassword = 'Passwords do not match';

    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate() || !token) return;

    setLoading(true);
    try {
      await authApi.resetPassword(token, newPassword, confirmPassword);
      setSuccess(true);
      message.success('Password reset successfully!');
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.response?.data?.errors?.[0] || err.message || 'Failed to reset password.';
      message.error(msg);
    } finally {
      setLoading(false);
    }
  };

  // Success state
  if (success) {
    return (
      <div className="h-screen flex items-center justify-center bg-[#F3F4F8] relative overflow-hidden p-3">
        <div className="absolute -top-[120px] -right-[120px] w-[400px] h-[400px] rounded-full pointer-events-none"
          style={{ background: 'radial-gradient(circle, rgba(0,155,58,0.06) 0%, transparent 70%)' }} />

        <div className="bg-white rounded-2xl p-10 max-w-[480px] w-full text-center shadow-[0_8px_40px_rgba(0,0,0,0.08)] relative z-10">
          <div className="w-16 h-16 bg-[rgba(0,155,58,0.1)] rounded-full flex items-center justify-center mx-auto mb-5">
            <FiCheckCircle className="text-2xl text-[#009B3A]" />
          </div>
          <h2 className="text-[20px] font-bold text-[#1A1F2E] tracking-tight mb-2">Password Reset Complete</h2>
          <p className="text-[13px] text-[#5F6880] mb-6 leading-relaxed">
            Your password has been successfully updated. You can now sign in with your new password.
          </p>
          <button
            onClick={() => navigate('/login')}
            className="inline-flex items-center gap-1.5 h-[42px] px-6 bg-[#009B3A] text-white rounded-[9px] text-[12px] font-bold hover:bg-[#007A2E] transition-all cursor-pointer border-none"
          >
            <FiArrowRight className="text-xs" /> Sign In
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
              Set Your<br />New Password
            </h1>
            <p className="text-[11px] text-white/60 leading-relaxed max-w-[300px]">
              Create a strong password that meets all the security requirements below.
            </p>

            <div className="mt-5 flex flex-col gap-2">
              {[
                'At least 8 characters',
                'One uppercase letter',
                'One lowercase letter',
                'One number',
                'One special character (!@#$%^&*)',
              ].map((req, i) => (
                <div key={i} className="flex items-center gap-2 text-[10.5px] text-white/55">
                  <FiCheckCircle className="text-[10px] text-[#4ADE80] flex-shrink-0" />
                  <span>{req}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="h-[3px] rounded-sm mt-6 opacity-45" style={{ background: 'linear-gradient(90deg, #fff 0%, #fff 35%, #CE1126 35%, #CE1126 55%, #1A1A1A 55%, #1A1A1A 75%, #E8611D 75%, #E8611D 100%)' }} />
        </div>

        {/* RIGHT PANEL */}
        <div className="flex-1 flex flex-col justify-center px-10 py-8">
          <div className="w-full max-w-[380px]">
            <div className="mb-6">
              <div className="text-[10px] font-semibold text-[#E8611D] uppercase tracking-widest mb-1">Security</div>
              <h2 className="text-[22px] font-bold text-[#1A1F2E] tracking-tight">Create new password</h2>
              <p className="text-[11px] text-[#99A1B3] mt-0.5">Choose a strong password for your account</p>
            </div>

            <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-3">
              <div>
                <label className="block text-[9.5px] font-semibold text-[#5F6880] uppercase tracking-wide mb-1">New Password</label>
                <div className="relative">
                  <FiLock className="absolute left-3 top-1/2 -translate-y-1/2 text-[#99A1B3] text-xs" />
                  <input
                    type={showNewPw ? 'text' : 'password'}
                    value={newPassword}
                    onChange={(e) => { setNewPassword(e.target.value); setErrors({}); }}
                    placeholder="Enter new password"
                    autoComplete="new-password"
                    className={`w-full h-[40px] pl-9 pr-10 border rounded-[9px] text-[12px] font-medium text-[#1A1F2E] bg-[#F7F8FA] outline-none transition-all placeholder:text-[#99A1B3] ${errors.newPassword ? 'border-[#CE1126]' : 'border-[#E3E7EE] focus:border-[#009B3A] focus:bg-white'}`}
                  />
                  <button type="button" onClick={() => setShowNewPw(!showNewPw)} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#99A1B3] hover:text-[#5F6880] p-1 cursor-pointer bg-transparent border-none" tabIndex={-1}>
                    {showNewPw ? <EyeInvisibleOutlined className="text-xs" /> : <EyeOutlined className="text-xs" />}
                  </button>
                </div>
                {errors.newPassword && <p className="text-[9px] text-[#CE1126] mt-1">{errors.newPassword}</p>}
              </div>

              <div>
                <label className="block text-[9.5px] font-semibold text-[#5F6880] uppercase tracking-wide mb-1">Confirm Password</label>
                <div className="relative">
                  <FiLock className="absolute left-3 top-1/2 -translate-y-1/2 text-[#99A1B3] text-xs" />
                  <input
                    type={showConfirmPw ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => { setConfirmPassword(e.target.value); setErrors({}); }}
                    placeholder="Confirm new password"
                    autoComplete="new-password"
                    className={`w-full h-[40px] pl-9 pr-10 border rounded-[9px] text-[12px] font-medium text-[#1A1F2E] bg-[#F7F8FA] outline-none transition-all placeholder:text-[#99A1B3] ${errors.confirmPassword ? 'border-[#CE1126]' : 'border-[#E3E7EE] focus:border-[#009B3A] focus:bg-white'}`}
                  />
                  <button type="button" onClick={() => setShowConfirmPw(!showConfirmPw)} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#99A1B3] hover:text-[#5F6880] p-1 cursor-pointer bg-transparent border-none" tabIndex={-1}>
                    {showConfirmPw ? <EyeInvisibleOutlined className="text-xs" /> : <EyeOutlined className="text-xs" />}
                  </button>
                </div>
                {errors.confirmPassword && <p className="text-[9px] text-[#CE1126] mt-1">{errors.confirmPassword}</p>}
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full h-[42px] bg-[#009B3A] text-white rounded-[9px] text-[12px] font-bold cursor-pointer transition-all hover:bg-[#007A2E] disabled:opacity-60 shadow-[0_2px_10px_rgba(0,155,58,0.22)] flex items-center justify-center gap-2"
              >
                {loading ? (
                  <span className="inline-block w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <><FiArrowRight className="text-xs" /> Reset Password</>
                )}
              </button>
            </form>

            <div className="mt-5">
              <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[9px] font-semibold text-[#007A2E] uppercase tracking-wide" style={{ background: 'rgba(0,155,58,0.06)', border: '1px solid rgba(0,155,58,0.12)' }}>
                <FiShield className="text-[9px]" /> Secure Reset
              </div>
              <p className="text-[9px] text-[#99A1B3] mt-2 leading-relaxed">This reset link expires in 1 hour for your security.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
