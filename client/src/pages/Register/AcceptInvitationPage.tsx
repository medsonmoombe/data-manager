import React, { useEffect, useState } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { message, Spin } from 'antd';
import { FiCheckCircle, FiAlertCircle, FiArrowRight, FiHome } from 'react-icons/fi';
import api from '../../api/axios';

/**
 * Accept Invitation Page
 * 
 * This page is shown when a user clicks the invitation link in their email.
 * 
 * URL format: /accept-invitation?org=org-slug&email=user@email.com
 * 
 * FLOW:
 * 1. User clicks link in email
 * 2. This page shows the organization they're joining
 * 3. User is prompted to log in
 * 4. After login, Keycloak forces password change
 * 5. User becomes a member of the organization
 */
export default function AcceptInvitationPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [state, setState] = useState<'loading' | 'valid' | 'expired' | 'error'>('loading');
  const [orgInfo, setOrgInfo] = useState<{ name: string; slug: string } | null>(null);

  const orgSlug = searchParams.get('org');
  const email = searchParams.get('email');

  useEffect(() => {
    if (!orgSlug || !email) {
      setState('error');
      return;
    }

    // Verify the invitation is valid by calling the backend
    verifyInvitation();
  }, [orgSlug, email]);

  const verifyInvitation = async () => {
    try {
      // Call the backend to check if this invitation exists and is valid
      const res: any = await api.get(`/auth/verify-invitation?org=${orgSlug}&email=${encodeURIComponent(email || '')}`);
      
      if (res.data?.valid) {
        setOrgInfo({ name: res.data.organizationName, slug: orgSlug || '' });
        setState('valid');
      } else {
        setState('expired');
      }
    } catch (err: any) {
      if (err?.response?.status === 404 || err?.response?.status === 400) {
        setState('expired');
      } else {
        setState('error');
      }
    }
  };

  const handleGoToLogin = () => {
    // Redirect to login page with org context
    navigate(`/login?org=${orgSlug}&email=${encodeURIComponent(email || '')}&invitation=true`);
  };

  // Loading state
  if (state === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F3F4F8]">
        <div className="text-center">
          <Spin size="small" />
          <p className="text-sm text-[#99A1B3] mt-3">Verifying your invitation...</p>
        </div>
      </div>
    );
  }

  // Valid invitation
  if (state === 'valid' && orgInfo) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F3F4F8] p-4">
        <div className="bg-white rounded-2xl p-10 max-w-[480px] w-full text-center shadow-lg">
          <div className="w-16 h-16 bg-[#F0FDF4] rounded-full flex items-center justify-center mx-auto mb-5">
            <FiCheckCircle className="text-3xl text-[#009B3A]" />
          </div>

          <h2 className="text-xl font-bold text-[#1A1F2E] font-[Space_Grotesk] mb-2">
            You've Been Invited!
          </h2>

          <div className="flex items-center justify-center gap-2 mb-4">
            <FiHome className="text-[#5F6880]" />
            <p className="text-sm text-[#5F6880]">
              Join <strong className="text-[#1A1F2E]">{orgInfo.name}</strong> on OmniCore Africa
            </p>
          </div>

          <p className="text-xs text-[#99A1B3] mb-2">
            You'll be signing in as <strong className="text-[#1A1F2E]">{email}</strong>
          </p>

          <div className="bg-[#FFF7ED] border border-[#FED7AA] rounded-lg p-3 mb-6 text-left">
            <p className="text-[11px] text-[#E8611D] font-medium mb-1">Important:</p>
            <ul className="text-[10px] text-[#5F6880] space-y-1 list-disc list-inside">
              <li>You'll log in with a temporary password</li>
              <li>You'll be asked to create a new password on first login</li>
              <li>Your account will be linked to {orgInfo.name}</li>
            </ul>
          </div>

          <button
            onClick={handleGoToLogin}
            className="w-full h-[46px] bg-[#009B3A] text-white rounded-[10px] text-sm font-bold flex items-center justify-center gap-2 hover:bg-[#007A2E] transition-all shadow-[0_2px_10px_rgba(0,155,58,0.22)]"
          >
            Continue to Login <FiArrowRight />
          </button>

          <p className="text-[10px] text-[#99A1B3] mt-4">
            This invitation link expires in 7 days.
          </p>
        </div>
      </div>
    );
  }

  // Expired or invalid invitation
  if (state === 'expired') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F3F4F8] p-4">
        <div className="bg-white rounded-2xl p-10 max-w-[480px] w-full text-center shadow-lg">
          <div className="w-16 h-16 bg-[#FEF2F2] rounded-full flex items-center justify-center mx-auto mb-5">
            <FiAlertCircle className="text-3xl text-[#CE1126]" />
          </div>
          <h2 className="text-xl font-bold text-[#1A1F2E] font-[Space_Grotesk] mb-2">Invitation Expired</h2>
          <p className="text-sm text-[#5F6880] mb-6">
            This invitation link has expired or is no longer valid.
            Please ask your organization admin to send a new invitation.
          </p>
          <Link to="/login" className="inline-flex items-center gap-2 px-6 py-2.5 bg-[#009B3A] text-white rounded-lg text-sm font-semibold hover:bg-[#007A2E] transition-all no-underline">
            Go to Login
          </Link>
        </div>
      </div>
    );
  }

  // Error state
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F3F4F8] p-4">
      <div className="bg-white rounded-2xl p-10 max-w-[480px] w-full text-center shadow-lg">
        <div className="w-16 h-16 bg-[#FEF2F2] rounded-full flex items-center justify-center mx-auto mb-5">
          <FiAlertCircle className="text-3xl text-[#CE1126]" />
        </div>
        <h2 className="text-xl font-bold text-[#1A1F2E] font-[Space_Grotesk] mb-2">Invalid Link</h2>
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