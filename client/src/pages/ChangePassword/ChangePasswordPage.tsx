import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { message } from 'antd';
import { FiLock, FiArrowRight, FiShield } from 'react-icons/fi';
import { EyeOutlined, EyeInvisibleOutlined } from '@ant-design/icons';
import { authApi } from '../../api/auth.api';
import { useAuthStore } from '../../stores/auth.store';

/**
 * Change Password Page
 *
 * Authenticated users can change their password from here.
 * Also shown when a user has UPDATE_PASSWORD as a required action.
 *
 * URL: /change-password
 */
export default function ChangePasswordPage() {
  const navigate = useNavigate();
  const logout = useAuthStore((s) => s.logout);
  const user = useAuthStore((s) => s.user);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const isRequiredAction = user?.required_actions?.includes('UPDATE_PASSWORD');

  const validate = () => {
    const e: Record<string, string> = {};
    if (!isRequiredAction && !currentPassword) e.currentPassword = 'Current password is required';
    if (!newPassword) e.newPassword = 'New password is required';
    else if (newPassword.length < 8) e.newPassword = 'Password must be at least 8 characters';
    else if (!/[A-Z]/.test(newPassword)) e.newPassword = 'Must contain at least one uppercase letter';
    else if (!/[a-z]/.test(newPassword)) e.newPassword = 'Must contain at least one lowercase letter';
    else if (!/[0-9]/.test(newPassword)) e.newPassword = 'Must contain at least one number';
    else if (!/[!@#$%^&*(),.?":{}|<>]/.test(newPassword)) e.newPassword = 'Must contain at least one special character';
    if (!confirmPassword) e.confirmPassword = 'Please confirm your password';
    else if (newPassword !== confirmPassword) e.confirmPassword = 'Passwords do not match';
    if (newPassword && currentPassword && newPassword === currentPassword) e.newPassword = 'New password must be different from current';

    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    setLoading(true);
    try {
      await authApi.changePassword(
        isRequiredAction ? '' : currentPassword,
        newPassword,
        confirmPassword,
        isRequiredAction,
      );
      message.success('Password changed successfully!');

      // Clear the UPDATE_PASSWORD required action from store
      if (isRequiredAction) {
        try { await authApi.clearAction('UPDATE_PASSWORD'); } catch { /* ignore */ }
        // Update the store to remove the required action
        const currentUser = useAuthStore.getState().user;
        if (currentUser?.required_actions) {
          useAuthStore.getState().updateUser({
            required_actions: currentUser.required_actions.filter((a) => a !== 'UPDATE_PASSWORD'),
          });
        }
      }

      navigate('/dashboard');
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.response?.data?.errors?.[0] || err.message || 'Failed to change password.';
      message.error(msg);
    } finally {
      setLoading(false);
    }
  };

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
              {isRequiredAction ? 'Update Your\nPassword' : 'Change Your\nPassword'}
            </h1>
            <p className="text-[11px] text-white/60 leading-relaxed max-w-[300px]">
              {isRequiredAction
                ? 'For security reasons, you need to create a new password before continuing.'
                : 'Enter your current password and choose a new one. Make sure it meets all requirements.'}
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
                  <FiShield className="text-[10px] text-[#4ADE80] flex-shrink-0" />
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
            {isRequiredAction && (
              <div className="bg-[#FFF7ED] border border-[#FED7AA] rounded-lg p-3 mb-4">
                <p className="text-[11px] text-[#E8611D] font-medium">
                  You must update your password before continuing. This is required for new accounts.
                </p>
              </div>
            )}

            <div className="mb-6">
              <div className="text-[10px] font-semibold text-[#E8611D] uppercase tracking-widest mb-1">Security</div>
              <h2 className="text-[22px] font-bold text-[#1A1F2E] tracking-tight">
                {isRequiredAction ? 'Set new password' : 'Change password'}
              </h2>
              <p className="text-[11px] text-[#99A1B3] mt-0.5">
                {isRequiredAction ? 'Choose a strong password for your account' : 'Verify your current password and set a new one'}
              </p>
            </div>

            <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-3">
              {!isRequiredAction && (
                <div>
                  <label className="block text-[9.5px] font-semibold text-[#5F6880] uppercase tracking-wide mb-1">Current Password</label>
                  <div className="relative">
                    <FiLock className="absolute left-3 top-1/2 -translate-y-1/2 text-[#99A1B3] text-xs" />
                    <input
                      type={showCurrent ? 'text' : 'password'}
                      value={currentPassword}
                      onChange={(e) => { setCurrentPassword(e.target.value); setErrors({}); }}
                      placeholder="Enter current password"
                      autoComplete="current-password"
                      className={`w-full h-[40px] pl-9 pr-10 border rounded-[9px] text-[12px] font-medium text-[#1A1F2E] bg-[#F7F8FA] outline-none transition-all placeholder:text-[#99A1B3] ${errors.currentPassword ? 'border-[#CE1126]' : 'border-[#E3E7EE] focus:border-[#009B3A] focus:bg-white'}`}
                    />
                    <button type="button" onClick={() => setShowCurrent(!showCurrent)} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#99A1B3] hover:text-[#5F6880] p-1 cursor-pointer bg-transparent border-none" tabIndex={-1}>
                      {showCurrent ? <EyeInvisibleOutlined className="text-xs" /> : <EyeOutlined className="text-xs" />}
                    </button>
                  </div>
                  {errors.currentPassword && <p className="text-[9px] text-[#CE1126] mt-1">{errors.currentPassword}</p>}
                </div>
              )}

              <div>
                <label className="block text-[9.5px] font-semibold text-[#5F6880] uppercase tracking-wide mb-1">New Password</label>
                <div className="relative">
                  <FiLock className="absolute left-3 top-1/2 -translate-y-1/2 text-[#99A1B3] text-xs" />
                  <input
                    type={showNew ? 'text' : 'password'}
                    value={newPassword}
                    onChange={(e) => { setNewPassword(e.target.value); setErrors({}); }}
                    placeholder="Enter new password"
                    autoComplete="new-password"
                    className={`w-full h-[40px] pl-9 pr-10 border rounded-[9px] text-[12px] font-medium text-[#1A1F2E] bg-[#F7F8FA] outline-none transition-all placeholder:text-[#99A1B3] ${errors.newPassword ? 'border-[#CE1126]' : 'border-[#E3E7EE] focus:border-[#009B3A] focus:bg-white'}`}
                  />
                  <button type="button" onClick={() => setShowNew(!showNew)} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#99A1B3] hover:text-[#5F6880] p-1 cursor-pointer bg-transparent border-none" tabIndex={-1}>
                    {showNew ? <EyeInvisibleOutlined className="text-xs" /> : <EyeOutlined className="text-xs" />}
                  </button>
                </div>
                {errors.newPassword && <p className="text-[9px] text-[#CE1126] mt-1">{errors.newPassword}</p>}
              </div>

              <div>
                <label className="block text-[9.5px] font-semibold text-[#5F6880] uppercase tracking-wide mb-1">Confirm Password</label>
                <div className="relative">
                  <FiLock className="absolute left-3 top-1/2 -translate-y-1/2 text-[#99A1B3] text-xs" />
                  <input
                    type={showConfirm ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => { setConfirmPassword(e.target.value); setErrors({}); }}
                    placeholder="Confirm new password"
                    autoComplete="new-password"
                    className={`w-full h-[40px] pl-9 pr-10 border rounded-[9px] text-[12px] font-medium text-[#1A1F2E] bg-[#F7F8FA] outline-none transition-all placeholder:text-[#99A1B3] ${errors.confirmPassword ? 'border-[#CE1126]' : 'border-[#E3E7EE] focus:border-[#009B3A] focus:bg-white'}`}
                  />
                  <button type="button" onClick={() => setShowConfirm(!showConfirm)} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#99A1B3] hover:text-[#5F6880] p-1 cursor-pointer bg-transparent border-none" tabIndex={-1}>
                    {showConfirm ? <EyeInvisibleOutlined className="text-xs" /> : <EyeOutlined className="text-xs" />}
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
                  <><FiArrowRight className="text-xs" /> {isRequiredAction ? 'Update Password' : 'Change Password'}</>
                )}
              </button>

              {!isRequiredAction && (
                <button
                  type="button"
                  onClick={() => navigate(-1)}
                  className="w-full h-[36px] bg-transparent border border-[#E3E7EE] text-[#5F6880] rounded-[9px] text-[11px] font-semibold cursor-pointer transition-all hover:bg-[#F7F8FA] hover:border-[#99A1B3]"
                >
                  Cancel
                </button>
              )}

              {isRequiredAction && (
                <button
                  type="button"
                  onClick={() => { logout(); navigate('/login'); }}
                  className="w-full h-[36px] bg-transparent border border-[#E3E7EE] text-[#5F6880] rounded-[9px] text-[11px] font-semibold cursor-pointer transition-all hover:bg-[#F7F8FA] hover:border-[#99A1B3]"
                >
                  Sign out instead
                </button>
              )}
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
