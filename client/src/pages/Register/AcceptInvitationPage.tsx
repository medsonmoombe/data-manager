import { useEffect, useState } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { Spin } from 'antd';
import { FiAlertCircle } from 'react-icons/fi';
import api from '../../api/axios';

/**
 * Accept Invitation Page
 *
 * Reached from the invitation email: /accept-invitation?token=xxx
 *
 * FLOW:
 * 1. Exchange the invitation token for a one-time "set password" token.
 * 2. Hand off to /reset-password so the user chooses their password.
 *
 * The invited account is created with no password, so there is nothing to sign
 * in with until this step completes.
 */
export default function AcceptInvitationPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [state, setState] = useState<'loading' | 'expired' | 'error'>('loading');

  const token = searchParams.get('token');

  useEffect(() => {
    if (!token) {
      setState('error');
      return;
    }
    acceptInvitation();
  }, [token]);

  const acceptInvitation = async () => {
    try {
      const res: any = await api.post('/invitations/accept', { token });
      const setPasswordToken = res?.data?.setPasswordToken;

      if (!setPasswordToken) {
        setState('error');
        return;
      }

      navigate(`/reset-password?token=${setPasswordToken}&invited=true`, { replace: true });
    } catch (err: any) {
      const status = err?.response?.status;
      setState(status === 404 || status === 400 ? 'expired' : 'error');
    }
  };

  if (state === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F3F4F8]">
        <div className="text-center">
          <Spin size="small" />
          <p className="text-sm text-[#99A1B3] mt-3">Accepting your invitation...</p>
        </div>
      </div>
    );
  }

  if (state === 'expired') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F3F4F8] p-4">
        <div className="bg-white rounded-2xl p-10 max-w-[480px] w-full text-center shadow-lg">
          <div className="w-16 h-16 bg-[#FEF2F2] rounded-full flex items-center justify-center mx-auto mb-5">
            <FiAlertCircle className="text-3xl text-[#CE1126]" />
          </div>
          <h2 className="text-xl font-bold text-[#1A1F2E] mb-2">Invitation Expired</h2>
          <p className="text-sm text-[#5F6880] mb-6">
            This invitation link has expired or has already been used.
            Please ask your organization admin to send a new invitation.
          </p>
          <Link to="/login" className="inline-flex items-center gap-2 px-6 py-2.5 bg-[#009B3A] text-white rounded-lg text-sm font-semibold hover:bg-[#007A2E] transition-all no-underline">
            Go to Login
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F3F4F8] p-4">
      <div className="bg-white rounded-2xl p-10 max-w-[480px] w-full text-center shadow-lg">
        <div className="w-16 h-16 bg-[#FEF2F2] rounded-full flex items-center justify-center mx-auto mb-5">
          <FiAlertCircle className="text-3xl text-[#CE1126]" />
        </div>
        <h2 className="text-xl font-bold text-[#1A1F2E] mb-2">Invalid Link</h2>
        <p className="text-sm text-[#5F6880] mb-6">
          This invitation link is missing required information.
        </p>
        <Link to="/login" className="inline-flex items-center gap-2 px-6 py-2.5 bg-[#009B3A] text-white rounded-lg text-sm font-semibold hover:bg-[#007A2E] transition-all no-underline">
          Go to Login
        </Link>
      </div>
    </div>
  );
}
